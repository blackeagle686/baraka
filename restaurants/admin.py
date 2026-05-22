from django.contrib import admin
from .models import Restaurant, MenuCategory, MenuItem, RestaurantRating, RestaurantNotification

admin.site.register(Restaurant)
admin.site.register(MenuCategory)
admin.site.register(MenuItem)
admin.site.register(RestaurantRating)
admin.site.register(RestaurantNotification)
