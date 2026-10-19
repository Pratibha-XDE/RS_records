import datetime
from decimal import Decimal
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from employees.models import Employee
from wages.models import EmployeeWageRate, GlobalWageSetting, WageBasis
from .models import DailyWorkRecord, Payment
from .services import (
    calculate_work_record_earnings,
    compute_payment_summary,
    process_work_record_payment,
)


class WorkRecordAndPaymentModelTests(TestCase):
    def setUp(self):
        self.employee = Employee.objects.create(name="Deepak Verma", is_active=True)

    def test_create_daily_work_record(self):
        record = DailyWorkRecord.objects.create(
            employee=self.employee,
            work_date=datetime.date(2026, 10, 1),
            hours_worked=8,
            minutes_worked=30,
            wage_rate=Decimal('800.00'),
            wage_basis=WageBasis.DAILY,
            base_amount=Decimal('800.00'),
            overtime_minutes=60,
            overtime_amount=Decimal('100.00'),
            extra_pay=Decimal('50.00'),
            total_earnings=Decimal('950.00'),
            notes="Completed foundation work"
        )
        self.assertEqual(record.total_earnings, Decimal('950.00'))
        self.assertEqual(record.hours_worked, 8)
        self.assertEqual(record.minutes_worked, 30)
        self.assertIn("Deepak Verma", str(record))

    def test_unique_employee_per_work_date_constraint(self):
        work_date = datetime.date(2026, 10, 2)
        DailyWorkRecord.objects.create(
            employee=self.employee,
            work_date=work_date,
            wage_rate=Decimal('800.00'),
            wage_basis=WageBasis.DAILY,
            base_amount=Decimal('800.00'),
            total_earnings=Decimal('800.00')
        )
        with self.assertRaises(IntegrityError):
            DailyWorkRecord.objects.create(
                employee=self.employee,
                work_date=work_date,
                wage_rate=Decimal('850.00'),
                wage_basis=WageBasis.DAILY,
                base_amount=Decimal('850.00'),
                total_earnings=Decimal('850.00')
            )

    def test_historical_wage_snapshot_preservation(self):
        wage_rate = EmployeeWageRate.objects.create(
            employee=self.employee,
            wage_amount=Decimal('800.00'),
            wage_basis=WageBasis.DAILY,
            effective_from=datetime.date(2026, 10, 1)
        )
        record = DailyWorkRecord.objects.create(
            employee=self.employee,
            work_date=datetime.date(2026, 10, 1),
            wage_rate=wage_rate.wage_amount,
            wage_basis=wage_rate.wage_basis,
            base_amount=Decimal('800.00'),
            total_earnings=Decimal('800.00')
        )
        wage_rate.wage_amount = Decimal('900.00')
        wage_rate.save()

        record.refresh_from_db()
        self.assertEqual(record.wage_rate, Decimal('800.00'))
        self.assertEqual(record.total_earnings, Decimal('800.00'))

    def test_multiple_payments_for_work_record(self):
        record = DailyWorkRecord.objects.create(
            employee=self.employee,
            work_date=datetime.date(2026, 10, 5),
            wage_rate=Decimal('1000.00'),
            wage_basis=WageBasis.DAILY,
            base_amount=Decimal('1000.00'),
            total_earnings=Decimal('1000.00')
        )
        p1 = Payment.objects.create(
            work_record=record,
            amount=Decimal('400.00'),
            payment_date=datetime.date(2026, 10, 5),
            payment_method='Cash'
        )
        p2 = Payment.objects.create(
            work_record=record,
            amount=Decimal('600.00'),
            payment_date=datetime.date(2026, 10, 6),
            payment_method='UPI'
        )
        self.assertEqual(record.payments.count(), 2)
        total_paid = sum(p.amount for p in record.payments.all())
        self.assertEqual(total_paid, Decimal('1000.00'))
        self.assertIn("Payment #", str(p1))

    def test_invalid_hours_worked(self):
        record = DailyWorkRecord(
            employee=self.employee,
            work_date=datetime.date(2026, 10, 7),
            hours_worked=25,
            wage_rate=Decimal('800.00'),
            wage_basis=WageBasis.DAILY,
            base_amount=Decimal('800.00'),
            total_earnings=Decimal('800.00')
        )
        with self.assertRaises(ValidationError):
            record.full_clean()


class EarningsCalculationTests(TestCase):
    def test_daily_wage_standard_8_hours(self):
        # 8 hours on 800 daily wage -> 800.00
        calc = calculate_work_record_earnings(
            wage_rate=Decimal('800.00'),
            wage_basis=WageBasis.DAILY,
            hours_worked=8,
            minutes_worked=0,
            overtime_minutes=0,
            extra_pay=Decimal('0.00')
        )
        self.assertEqual(calc['base_amount'], Decimal('800.00'))
        self.assertEqual(calc['overtime_amount'], Decimal('0.00'))
        self.assertEqual(calc['total_earnings'], Decimal('800.00'))

    def test_daily_wage_half_day(self):
        # 4 hours on 800 daily wage -> 400.00
        calc = calculate_work_record_earnings(
            wage_rate=Decimal('800.00'),
            wage_basis=WageBasis.DAILY,
            hours_worked=4,
            minutes_worked=0,
            overtime_minutes=0,
            extra_pay=Decimal('0.00')
        )
        self.assertEqual(calc['base_amount'], Decimal('400.00'))
        self.assertEqual(calc['total_earnings'], Decimal('400.00'))

    def test_daily_wage_with_overtime_and_extra_pay(self):
        # 8 hours + 60 min overtime + 50 extra pay
        # Rate: 800/8 = 100/hr, overtime = 1 hr * 100 * 1.0 = 100
        calc = calculate_work_record_earnings(
            wage_rate=Decimal('800.00'),
            wage_basis=WageBasis.DAILY,
            hours_worked=8,
            minutes_worked=0,
            overtime_minutes=60,
            extra_pay=Decimal('50.00')
        )
        self.assertEqual(calc['base_amount'], Decimal('800.00'))
        self.assertEqual(calc['overtime_amount'], Decimal('100.00'))
        self.assertEqual(calc['extra_pay'], Decimal('50.00'))
        self.assertEqual(calc['total_earnings'], Decimal('950.00'))

    def test_hourly_wage_calculation(self):
        # 7 hours 30 mins at 100/hr -> 7.5 * 100 = 750.00
        calc = calculate_work_record_earnings(
            wage_rate=Decimal('100.00'),
            wage_basis=WageBasis.HOURLY,
            hours_worked=7,
            minutes_worked=30,
            overtime_minutes=45,
            extra_pay=Decimal('20.00')
        )
        self.assertEqual(calc['base_amount'], Decimal('750.00'))
        # Overtime: 45 / 60 * 100 = 75.00
        self.assertEqual(calc['overtime_amount'], Decimal('75.00'))
        self.assertEqual(calc['total_earnings'], Decimal('845.00'))

    def test_payment_summary_statuses(self):
        # Not paid
        summary = compute_payment_summary(Decimal('1000.00'), Decimal('0.00'))
        self.assertEqual(summary['payment_status'], 'not_paid')
        self.assertEqual(summary['balance_due'], Decimal('1000.00'))

        # Partially paid
        summary = compute_payment_summary(Decimal('1000.00'), Decimal('400.00'))
        self.assertEqual(summary['payment_status'], 'partially_paid')
        self.assertEqual(summary['balance_due'], Decimal('600.00'))

        # Fully paid
        summary = compute_payment_summary(Decimal('1000.00'), Decimal('1000.00'))
        self.assertEqual(summary['payment_status'], 'paid')
        self.assertEqual(summary['balance_due'], Decimal('0.00'))

        # Zero earnings -> paid
        summary = compute_payment_summary(Decimal('0.00'), Decimal('0.00'))
        self.assertEqual(summary['payment_status'], 'paid')
        self.assertEqual(summary['balance_due'], Decimal('0.00'))


class WorkRecordAndPaymentAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_user = User.objects.create_user(
            username='admin',
            password='adminpassword123',
            is_staff=True,
            is_superuser=True
        )
        self.employee = Employee.objects.create(name="Deepak Verma", is_active=True)
        # Global wage: 800 daily
        self.global_wage = GlobalWageSetting.objects.create(
            wage_amount=Decimal('800.00'),
            wage_basis=WageBasis.DAILY,
            effective_from=datetime.date(2026, 1, 1)
        )

    def test_unauthenticated_work_records_denied(self):
        response = self.client.get('/api/work-records/')
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_create_work_record_with_automatic_earnings(self):
        self.client.force_authenticate(user=self.admin_user)
        payload = {
            'employee': self.employee.id,
            'work_date': '2026-10-01',
            'hours_worked': 8,
            'minutes_worked': 0,
            'overtime_minutes': 60,
            'extra_pay': '50.00',
            'notes': 'Excavation day 1'
        }
        response = self.client.post('/api/work-records/', payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['wage_rate'], '800.00')
        self.assertEqual(response.data['wage_basis'], 'daily')
        self.assertEqual(response.data['base_amount'], '800.00')
        self.assertEqual(response.data['overtime_amount'], '100.00')
        self.assertEqual(response.data['extra_pay'], '50.00')
        self.assertEqual(response.data['total_earnings'], '950.00')
        self.assertEqual(response.data['total_paid'], '0.00')
        self.assertEqual(response.data['balance_due'], '950.00')
        self.assertEqual(response.data['payment_status'], 'not_paid')

    def test_reject_work_record_for_inactive_employee(self):
        self.client.force_authenticate(user=self.admin_user)
        self.employee.is_active = False
        self.employee.save()

        payload = {
            'employee': self.employee.id,
            'work_date': '2026-10-02',
            'hours_worked': 8,
            'minutes_worked': 0
        }
        response = self.client.post('/api/work-records/', payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reject_duplicate_work_record_same_employee_and_date(self):
        self.client.force_authenticate(user=self.admin_user)
        payload = {
            'employee': self.employee.id,
            'work_date': '2026-10-03',
            'hours_worked': 8,
            'minutes_worked': 0
        }
        r1 = self.client.post('/api/work-records/', payload)
        self.assertEqual(r1.status_code, status.HTTP_201_CREATED)

        # Duplicate attempt
        r2 = self.client.post('/api/work-records/', payload)
        self.assertEqual(r2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_client_financial_fields_ignored_and_computed_server_side(self):
        self.client.force_authenticate(user=self.admin_user)
        # Attempt to spoof wage_rate and total_earnings
        payload = {
            'employee': self.employee.id,
            'work_date': '2026-10-04',
            'hours_worked': 8,
            'minutes_worked': 0,
            'wage_rate': '9999.00',
            'total_earnings': '99999.00'
        }
        response = self.client.post('/api/work-records/', payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # Server must use resolved wage rate 800.00, not spoofed 9999.00
        self.assertEqual(response.data['wage_rate'], '800.00')
        self.assertEqual(response.data['total_earnings'], '800.00')

    def test_update_work_record_preserves_wage_snapshot_and_recomputes_earnings(self):
        self.client.force_authenticate(user=self.admin_user)
        # 1. Create record with rate 800
        record = DailyWorkRecord.objects.create(
            employee=self.employee,
            work_date=datetime.date(2026, 10, 5),
            hours_worked=8,
            minutes_worked=0,
            wage_rate=Decimal('800.00'),
            wage_basis=WageBasis.DAILY,
            base_amount=Decimal('800.00'),
            total_earnings=Decimal('800.00')
        )
        # 2. Later, global wage rate changes to 1200
        self.global_wage.wage_amount = Decimal('1200.00')
        self.global_wage.save()

        # 3. Client updates hours worked to 4 (half day)
        response = self.client.patch(f'/api/work-records/{record.id}/', {'hours_worked': 4})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        record.refresh_from_db()
        # Rate snapshot must remain 800.00 (NOT updated to 1200.00)
        self.assertEqual(record.wage_rate, Decimal('800.00'))
        # Earnings recalculated proportionally: 4/8 * 800 = 400.00
        self.assertEqual(record.base_amount, Decimal('400.00'))
        self.assertEqual(record.total_earnings, Decimal('400.00'))

    def test_filter_work_records(self):
        self.client.force_authenticate(user=self.admin_user)
        emp2 = Employee.objects.create(name="Second Worker")
        DailyWorkRecord.objects.create(
            employee=self.employee,
            work_date=datetime.date(2026, 10, 10),
            hours_worked=8,
            wage_rate=Decimal('800.00'),
            wage_basis='daily',
            base_amount=Decimal('800.00'),
            total_earnings=Decimal('800.00')
        )
        DailyWorkRecord.objects.create(
            employee=emp2,
            work_date=datetime.date(2026, 10, 15),
            hours_worked=8,
            wage_rate=Decimal('800.00'),
            wage_basis='daily',
            base_amount=Decimal('800.00'),
            total_earnings=Decimal('800.00')
        )

        # Filter by employee
        resp = self.client.get(f'/api/work-records/?employee={self.employee.id}')
        results = resp.data['results'] if 'results' in resp.data else resp.data
        self.assertEqual(len(results), 1)

        # Filter by date range
        resp = self.client.get('/api/work-records/?start_date=2026-10-12&end_date=2026-10-20')
        results = resp.data['results'] if 'results' in resp.data else resp.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['employee'], emp2.id)

    def test_payments_and_status_transitions(self):
        self.client.force_authenticate(user=self.admin_user)
        record = DailyWorkRecord.objects.create(
            employee=self.employee,
            work_date=datetime.date(2026, 10, 20),
            hours_worked=8,
            wage_rate=Decimal('1000.00'),
            wage_basis='daily',
            base_amount=Decimal('1000.00'),
            total_earnings=Decimal('1000.00')
        )

        # 1. Check initial status: not_paid
        resp = self.client.get(f'/api/work-records/{record.id}/')
        self.assertEqual(resp.data['payment_status'], 'not_paid')
        self.assertEqual(resp.data['total_paid'], '0.00')
        self.assertEqual(resp.data['balance_due'], '1000.00')

        # 2. Record partial payment: 400
        pay_payload = {
            'work_record': record.id,
            'amount': '400.00',
            'payment_date': '2026-10-20',
            'payment_method': 'Cash'
        }
        pay_resp = self.client.post('/api/payments/', pay_payload)
        self.assertEqual(pay_resp.status_code, status.HTTP_201_CREATED)

        resp = self.client.get(f'/api/work-records/{record.id}/')
        self.assertEqual(resp.data['payment_status'], 'partially_paid')
        self.assertEqual(resp.data['total_paid'], '400.00')
        self.assertEqual(resp.data['balance_due'], '600.00')

        # 3. Reject overpayment (e.g. 700 when balance is 600)
        overpay_payload = {
            'work_record': record.id,
            'amount': '700.00',
            'payment_date': '2026-10-21'
        }
        overpay_resp = self.client.post('/api/payments/', overpay_payload)
        self.assertEqual(overpay_resp.status_code, status.HTTP_400_BAD_REQUEST)

        # 4. Final payment of remaining balance: 600
        final_pay = {
            'work_record': record.id,
            'amount': '600.00',
            'payment_date': '2026-10-21',
            'payment_method': 'UPI'
        }
        final_resp = self.client.post('/api/payments/', final_pay)
        self.assertEqual(final_resp.status_code, status.HTTP_201_CREATED)

        resp = self.client.get(f'/api/work-records/{record.id}/')
        self.assertEqual(resp.data['payment_status'], 'paid')
        self.assertEqual(resp.data['total_paid'], '1000.00')
        self.assertEqual(resp.data['balance_due'], '0.00')

        # 5. Nested payments endpoint
        payments_resp = self.client.get(f'/api/work-records/{record.id}/payments/')
        self.assertEqual(payments_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(payments_resp.data), 2)

    def test_reject_zero_or_negative_payment(self):
        self.client.force_authenticate(user=self.admin_user)
        record = DailyWorkRecord.objects.create(
            employee=self.employee,
            work_date=datetime.date(2026, 10, 22),
            wage_rate=Decimal('500.00'),
            wage_basis='daily',
            base_amount=Decimal('500.00'),
            total_earnings=Decimal('500.00')
        )
        response = self.client.post('/api/payments/', {
            'work_record': record.id,
            'amount': '0.00',
            'payment_date': '2026-10-22'
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reject_payment_physical_deletion(self):
        self.client.force_authenticate(user=self.admin_user)
        record = DailyWorkRecord.objects.create(
            employee=self.employee,
            work_date=datetime.date(2026, 10, 23),
            wage_rate=Decimal('500.00'),
            wage_basis='daily',
            base_amount=Decimal('500.00'),
            total_earnings=Decimal('500.00')
        )
        payment = Payment.objects.create(
            work_record=record,
            amount=Decimal('200.00'),
            payment_date=datetime.date(2026, 10, 23)
        )
        response = self.client.delete(f'/api/payments/{payment.id}/')
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertTrue(Payment.objects.filter(id=payment.id).exists())

    def test_reject_work_record_delete_with_payments(self):
        self.client.force_authenticate(user=self.admin_user)
        record = DailyWorkRecord.objects.create(
            employee=self.employee,
            work_date=datetime.date(2026, 10, 24),
            wage_rate=Decimal('500.00'),
            wage_basis='daily',
            base_amount=Decimal('500.00'),
            total_earnings=Decimal('500.00')
        )
        Payment.objects.create(
            work_record=record,
            amount=Decimal('200.00'),
            payment_date=datetime.date(2026, 10, 24)
        )
        response = self.client.delete(f'/api/work-records/{record.id}/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(DailyWorkRecord.objects.filter(id=record.id).exists())
