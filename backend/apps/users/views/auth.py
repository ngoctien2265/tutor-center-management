from rest_framework_simplejwt.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView


class RoleApprovalTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        if self.user.role in ['staff', 'tutor'] and self.user.status != 'active':
            raise AuthenticationFailed('Tài khoản của bạn đang chờ admin hoặc nhân viên trung tâm duyệt.', 'account_pending_approval')
        return data


class RoleApprovalTokenObtainPairView(TokenObtainPairView):
    serializer_class = RoleApprovalTokenObtainPairSerializer
