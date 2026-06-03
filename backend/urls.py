from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenRefreshView
from apps.users.urls import admin_urlpatterns, staff_urlpatterns, tutor_urlpatterns, customer_urlpatterns
from apps.users.views.auth import RoleApprovalTokenObtainPairView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/token/', RoleApprovalTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/users/', include('apps.users.urls')),
    path('api/classes/', include('apps.classes.urls')),
    path('api/finance/', include('apps.finance.urls')),
    path('api/feedback/', include('apps.feedback.urls')),
    path('api/v1/admin/', include(admin_urlpatterns)),
    path('api/v1/tutor/', include(tutor_urlpatterns)),
    path('api/v1/staff/', include(staff_urlpatterns)),
    path('api/v1/customer/', include(customer_urlpatterns)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
