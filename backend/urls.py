"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from users.models import User

def temp_create_admin(request):
    try:
        user, created = User.objects.get_or_create(
            phone='01095513686',
            defaults={
                'name': 'Admin Baraka',
                'role': 'ADMIN',
                'is_staff': True,
                'is_superuser': True,
                'is_approved': True
            }
        )
        user.set_password('admin/vesta/1680/baraka')
        user.is_staff = True
        user.is_superuser = True
        user.role = 'ADMIN'
        user.save()
        if created:
            return JsonResponse({'status': 'success', 'message': 'Admin user created successfully!'})
        else:
            return JsonResponse({'status': 'success', 'message': 'Admin user already existed, credentials reset successfully!'})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('users.urls')),
    path('api/', include('shops.urls')),
    path('api/', include('orders.urls')),
    path('api/', include('core.urls')),
    path('api/temp-create-admin/', temp_create_admin),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
