from rest_framework import permissions


class IsDoctorOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_authenticated and request.user.role == 'DOCTOR'

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        if hasattr(obj, 'doctor'):
            return obj.doctor == request.user
        if hasattr(obj, 'clinic'):
            return obj.clinic.doctor == request.user
        return False


class IsPatientOrDoctor(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        if hasattr(obj, 'patient'):
            return obj.patient == request.user or obj.clinic.doctor == request.user
        if hasattr(obj, 'clinic'):
            return obj.clinic.doctor == request.user
        return False
