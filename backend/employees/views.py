from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import MethodNotAllowed
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter, OpenApiTypes

from config.permissions import IsAuthenticatedAdmin
from .models import Employee
from .serializers import EmployeeSerializer


@extend_schema_view(
    list=extend_schema(
        summary="List employees",
        description="List all registered employees with optional filtering by active status and search by name or phone number.",
        parameters=[
            OpenApiParameter(
                name='is_active',
                type=OpenApiTypes.BOOL,
                location=OpenApiParameter.QUERY,
                description='Filter by active status (true or false)'
            ),
            OpenApiParameter(
                name='search',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description='Search by employee name or phone number'
            ),
        ]
    ),
    retrieve=extend_schema(summary="Retrieve employee details"),
    create=extend_schema(summary="Register a new employee"),
    update=extend_schema(summary="Update an employee's profile"),
    partial_update=extend_schema(summary="Partially update an employee's profile"),
)
class EmployeeViewSet(viewsets.ModelViewSet):
    """
    CRUD API for Employee management.
    Restricted to authenticated administrators.
    """
    queryset = Employee.objects.all().order_by('name', '-created_at')
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated, IsAuthenticatedAdmin]

    def get_queryset(self):
        queryset = super().get_queryset()
        is_active_param = self.request.query_params.get('is_active')
        if is_active_param is not None:
            if is_active_param.lower() in ('true', '1'):
                queryset = queryset.filter(is_active=True)
            elif is_active_param.lower() in ('false', '0'):
                queryset = queryset.filter(is_active=False)

        search_query = self.request.query_params.get('search')
        if search_query:
            search_query = search_query.strip()
            queryset = queryset.filter(
                Q(name__icontains=search_query) | Q(phone_number__icontains=search_query)
            )

        return queryset

    def destroy(self, request, *args, **kwargs):
        """
        Disallow hard deletion of employees to safeguard historical work and payment records.
        """
        raise MethodNotAllowed(
            method='DELETE',
            detail="Physical deletion of employees is not permitted. Deactivate the employee instead using /api/employees/{id}/deactivate/."
        )

    @extend_schema(
        request=None,
        responses={200: EmployeeSerializer},
        summary="Deactivate employee",
        description="Mark an employee as inactive. Historical work records remain intact."
    )
    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        employee = self.get_object()
        employee.is_active = False
        employee.save(update_fields=['is_active', 'updated_at'])
        serializer = self.get_serializer(employee)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        request=None,
        responses={200: EmployeeSerializer},
        summary="Reactivate employee",
        description="Re-enable an employee to permit new work record entries."
    )
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        employee = self.get_object()
        employee.is_active = True
        employee.save(update_fields=['is_active', 'updated_at'])
        serializer = self.get_serializer(employee)
        return Response(serializer.data, status=status.HTTP_200_OK)
