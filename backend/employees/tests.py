import datetime
from decimal import Decimal
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from work_records.models import DailyWorkRecord
from .models import Employee


class EmployeeModelTests(TestCase):
    def test_create_employee_with_required_fields(self):
        emp = Employee.objects.create(name="Ramesh Kumar")
        self.assertEqual(emp.name, "Ramesh Kumar")
        self.assertTrue(emp.is_active)
        self.assertIsNone(emp.phone_number)
        self.assertIsNone(emp.age)
        self.assertIsNotNone(emp.created_at)
        self.assertIsNotNone(emp.updated_at)
        self.assertEqual(str(emp), "Ramesh Kumar")

    def test_create_employee_with_all_fields(self):
        emp = Employee.objects.create(
            name="Suresh Patel",
            phone_number="9876543210",
            age=32,
            is_active=True
        )
        self.assertEqual(emp.name, "Suresh Patel")
        self.assertEqual(emp.phone_number, "9876543210")
        self.assertEqual(emp.age, 32)
        self.assertTrue(emp.is_active)

    def test_employee_age_validation(self):
        emp = Employee(name="Invalid Age", age=150)
        with self.assertRaises(ValidationError):
            emp.full_clean()

    def test_employee_age_negative_validation(self):
        emp = Employee(name="Negative Age", age=0)
        with self.assertRaises(ValidationError):
            emp.full_clean()


class EmployeeAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_user = User.objects.create_user(
            username='admin',
            password='adminpassword123',
            is_staff=True,
            is_superuser=True
        )
        self.regular_user = User.objects.create_user(
            username='worker',
            password='workerpassword123',
            is_staff=False
        )
        self.employee = Employee.objects.create(
            name="Vijay Kumar",
            phone_number="9988776655",
            age=29,
            is_active=True
        )

    def test_unauthenticated_request_rejected(self):
        response = self.client.get('/api/employees/')
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_non_staff_user_forbidden(self):
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get('/api/employees/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_list_employees(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/employees/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Check paginated results
        results = response.data['results'] if 'results' in response.data else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['name'], "Vijay Kumar")

    def test_create_employee(self):
        self.client.force_authenticate(user=self.admin_user)
        payload = {
            'name': 'Pooja Verma',
            'phone_number': '9123456780',
            'age': 25,
            'is_active': True
        }
        response = self.client.post('/api/employees/', payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Pooja Verma')
        self.assertTrue(Employee.objects.filter(name='Pooja Verma').exists())

    def test_create_employee_validation_errors(self):
        self.client.force_authenticate(user=self.admin_user)
        # Blank name
        response = self.client.post('/api/employees/', {'name': '   '})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Invalid age
        response = self.client.post('/api/employees/', {'name': 'Valid Name', 'age': 150})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_retrieve_and_update_employee(self):
        self.client.force_authenticate(user=self.admin_user)
        # Retrieve
        response = self.client.get(f'/api/employees/{self.employee.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Vijay Kumar')

        # Update (PATCH)
        response = self.client.patch(f'/api/employees/{self.employee.id}/', {'age': 30})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.age, 30)

    def test_deactivate_and_activate_employee(self):
        self.client.force_authenticate(user=self.admin_user)
        # Deactivate
        response = self.client.post(f'/api/employees/{self.employee.id}/deactivate/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.employee.refresh_from_db()
        self.assertFalse(self.employee.is_active)

        # Reactivate
        response = self.client.post(f'/api/employees/{self.employee.id}/activate/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.employee.refresh_from_db()
        self.assertTrue(self.employee.is_active)

    def test_filter_and_search_employees(self):
        self.client.force_authenticate(user=self.admin_user)
        Employee.objects.create(name="Inactive Worker", is_active=False)

        # Filter active
        response = self.client.get('/api/employees/?is_active=true')
        results = response.data['results'] if 'results' in response.data else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['name'], 'Vijay Kumar')

        # Filter inactive
        response = self.client.get('/api/employees/?is_active=false')
        results = response.data['results'] if 'results' in response.data else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['name'], 'Inactive Worker')

        # Search
        response = self.client.get('/api/employees/?search=Vijay')
        results = response.data['results'] if 'results' in response.data else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['name'], 'Vijay Kumar')

    def test_physical_delete_is_disallowed(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.delete(f'/api/employees/{self.employee.id}/')
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertTrue(Employee.objects.filter(id=self.employee.id).exists())

    def test_historical_work_records_remain_when_employee_deactivated(self):
        self.client.force_authenticate(user=self.admin_user)
        work_record = DailyWorkRecord.objects.create(
            employee=self.employee,
            work_date=datetime.date(2026, 10, 1),
            hours_worked=8,
            minutes_worked=0,
            wage_rate=Decimal('800.00'),
            wage_basis='daily',
            base_amount=Decimal('800.00'),
            total_earnings=Decimal('800.00')
        )

        # Deactivate employee
        response = self.client.post(f'/api/employees/{self.employee.id}/deactivate/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Historical work record remains intact
        work_record.refresh_from_db()
        self.assertEqual(work_record.employee_id, self.employee.id)
        self.assertEqual(work_record.total_earnings, Decimal('800.00'))
