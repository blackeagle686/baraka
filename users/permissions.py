from rest_framework import permissions


class IsAdminUserRole(permissions.BasePermission):
    """Only allow users with role == 'ADMIN' to access."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and (request.user.role == 'ADMIN' or request.user.is_staff or request.user.is_superuser)
        )
