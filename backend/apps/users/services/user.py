from ..models import User


class UserService:
    @staticmethod
    def change_password(user, old_password, new_password):
        if not user.check_password(old_password):
            return False
        user.set_password(new_password)
        user.save()
        return True

    @staticmethod
    def get_user_by_email(email):
        try:
            return User.objects.get(email=email)
        except User.DoesNotExist:
            return None

    @staticmethod
    def deactivate_user(user):
        user.status = 'inactive'
        user.save()
        return user
