from rest_framework import serializers
from .models import Employee


class EmployeeSerializer(serializers.ModelSerializer):
    """
    Serializer for Employee instances.
    Enforces age limits and protects server-managed timestamps and identifiers.
    """
    class Meta:
        model = Employee
        fields = [
            'id',
            'name',
            'phone_number',
            'age',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_age(self, value):
        if value is not None and (value < 1 or value > 120):
            raise serializers.ValidationError("Age must be between 1 and 120 years.")
        return value

    def validate_name(self, value):
        stripped = value.strip()
        if not stripped:
            raise serializers.ValidationError("Employee name cannot be blank.")
        return stripped
