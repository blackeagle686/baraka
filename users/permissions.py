from rest_framework import permissions


class IsAdminUserRole(permissions.BasePermission):
    """Only allow users with role == 'ADMIN' to access."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and (request.user.role == 'ADMIN' or request.user.is_staff or request.user.is_superuser)
        )

class IsApprovedUser(permissions.BasePermission):
    """Only allow users with is_approved=True to access."""
    message = "حسابك قيد المراجعة. يرجى الانتظار حتى يتم اعتماد الحساب من قبل الإدارة."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.is_approved
        )

class IsApprovedOrReadOnly(permissions.BasePermission):
    """Only allow approved users to write, anyone can read."""
    message = "حسابك قيد المراجعة. لا يمكنك تنفيذ هذا الإجراء حتى يتم اعتمادك."

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return (
            request.user
            and request.user.is_authenticated
            and request.user.is_approved
        )
