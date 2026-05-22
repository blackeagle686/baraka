from rest_framework import serializers
from django.core.exceptions import ValidationError as DjangoValidationError

from .models import Clinic, MedicalService, TimeSlot, Appointment, ClinicRating
from users.validators import validate_secure_file


class MedicalServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicalService
        fields = '__all__'
        read_only_fields = ['clinic']


class TimeSlotSerializer(serializers.ModelSerializer):
    service_details = serializers.SerializerMethodField()

    class Meta:
        model = TimeSlot
        fields = '__all__'
        read_only_fields = ['clinic']

    def get_service_details(self, obj):
        if obj.service_id:
            svc = obj.service
            if svc:
                return {
                    'id': svc.id,
                    'name': svc.name,
                    'duration_minutes': svc.duration_minutes,
                    'price': str(svc.price),
                }
        return None


class AppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.ReadOnlyField(source='patient.name')
    patient_phone = serializers.ReadOnlyField(source='patient.phone')
    service_name = serializers.ReadOnlyField(source='service.name')
    clinic_name = serializers.ReadOnlyField(source='clinic.name')

    class Meta:
        model = Appointment
        fields = '__all__'
        read_only_fields = ['patient']


class AppointmentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointment
        fields = [
            'clinic', 'service', 'time_slot', 'date',
            'start_time', 'end_time', 'notes', 'price'
        ]


class AppointmentUpdateStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[
        'CONFIRMED', 'COMPLETED', 'CANCELLED'
    ])


class ClinicRatingSerializer(serializers.ModelSerializer):
    patient_name = serializers.ReadOnlyField(source='patient.name')
    patient_phone = serializers.ReadOnlyField(source='patient.phone')

    class Meta:
        model = ClinicRating
        fields = ['id', 'clinic', 'patient_name', 'patient_phone', 'rating', 'review', 'created_at']
        read_only_fields = ['patient']


class ClinicCreateSerializer(serializers.ModelSerializer):
    def validate_image(self, value):
        try:
            return validate_secure_file(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.message)

    class Meta:
        model = Clinic
        fields = [
            'name', 'description', 'specialization', 'phone', 'image',
            'address', 'latitude', 'longitude', 'is_open',
            'opening_time', 'closing_time'
        ]


class ClinicSerializer(serializers.ModelSerializer):
    services = MedicalServiceSerializer(many=True, read_only=True)
    doctor_name = serializers.ReadOnlyField(source='doctor.name')
    doctor_phone = serializers.ReadOnlyField(source='doctor.phone')

    def validate_image(self, value):
        try:
            return validate_secure_file(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.message)

    average_rating = serializers.SerializerMethodField()
    total_ratings = serializers.SerializerMethodField()
    ratings_list = ClinicRatingSerializer(source='ratings', many=True, read_only=True)

    class Meta:
        model = Clinic
        fields = '__all__'
        read_only_fields = ['doctor']

    def get_average_rating(self, obj):
        ratings = obj.ratings.all()
        if ratings.exists():
            return round(sum(r.rating for r in ratings) / len(ratings), 1)
        return 0.0

    def get_total_ratings(self, obj):
        return obj.ratings.count()
