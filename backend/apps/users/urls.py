from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, TutorViewSet, StudentViewSet
from .views import tutor as tutor_views
from .views import staff as staff_views
from .views import admin as admin_views
from .views import customer as customer_views
from .views import register as register_views

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'tutors', TutorViewSet)
router.register(r'students', StudentViewSet)

admin_urlpatterns = [
    path('dashboard', admin_views.dashboard),
    path('finance/summary', admin_views.finance_summary),
    path('class-requests', admin_views.class_requests),
    path('classes/<int:class_id>/review', admin_views.review_class),
    path('staff', admin_views.staff_members),
    path('staff/<int:staff_id>/verify', admin_views.verify_staff),
    path('staff/<int:staff_id>/unverify', admin_views.unverify_staff),
    path('staff/<int:staff_id>', admin_views.delete_staff),
    path('tutors/<int:tutor_id>/verify', admin_views.verify_tutor),
    path('tutors/<int:tutor_id>/unverify', admin_views.unverify_tutor),
    path('users/<int:user_id>/profile', admin_views.user_profile),
    path('users/<int:user_id>/lock', admin_views.lock_user),
    path('users/<int:user_id>/unlock', admin_views.unlock_user),
    path('users/<int:user_id>/approve', admin_views.approve_user),
    path('users/<int:user_id>/reject', admin_views.reject_user),
    path('users', admin_views.create_user),
    path('users/<int:user_id>', admin_views.update_user),
    path('users/<int:user_id>/delete', admin_views.delete_user),
    path('parents', admin_views.parents),
    path('parents/<int:parent_id>/verify', admin_views.verify_parent),
    path('parents/<int:parent_id>/unverify', admin_views.unverify_parent),
]


staff_urlpatterns = [
    path('dashboard', staff_views.dashboard),
    path('classes', staff_views.classes),
    path('classes/<int:class_id>', staff_views.class_detail),
    path('classes/<int:class_id>/assign-tutor', staff_views.assign_tutor),
    path('classes/<int:class_id>/change-status', staff_views.change_class_status),
    path('classes/<int:class_id>/review-request', staff_views.review_class_request),
    path('classes/<int:class_id>/teaching-logs', staff_views.teaching_logs),
    path('teaching-logs', staff_views.all_teaching_logs),
    path('teaching-logs/<int:log_id>', staff_views.teaching_log_detail),
    path('teaching-logs/<int:log_id>/confirm', staff_views.confirm_teaching_log),
    path('finance', staff_views.finance),
    path('enrollments/<int:enrollment_id>/status', staff_views.change_enrollment_status),
    path('applications', staff_views.applications),
    path('applications/<int:application_id>/review', staff_views.review_application),
    path('absence-requests', staff_views.absence_requests),
    path('absence-requests/<int:request_id>/review', staff_views.review_absence),
    path('qualifications', staff_views.qualifications),
    path('qualifications/<int:qualification_id>/review', staff_views.review_qualification),
    path('tutors', staff_views.tutors),
    path('tutors/<int:tutor_id>/invite', staff_views.invite_tutor),
    path('tutors/<int:tutor_id>/timetable', staff_views.tutor_timetable),
    path('tutors/<int:tutor_id>', staff_views.tutor_detail),
    path('students', staff_views.students),
    path('students/<int:student_id>', staff_views.student_detail),
]


customer_urlpatterns = [
    path('profile', customer_views.profile),
    path('students', customer_views.students_collection),
    path('students/<int:student_id>', customer_views.student_detail),
    path('class-requests', customer_views.class_requests),
    path('classes', customer_views.classes),
    path('classes/<int:class_id>/confirm-tutor', customer_views.confirm_tutor),
    path('timetable', customer_views.timetable),
    path('payments', customer_views.payments),
    path('payments/<int:transaction_id>/pay', customer_views.pay),
    path('reviews', customer_views.reviews),
    path('classes/<int:class_id>/reviews', customer_views.reviews),
]


tutor_urlpatterns = [
    path('dashboard', tutor_views.dashboard),
    path('profile', tutor_views.profile),
    path('profile/avatar', tutor_views.upload_avatar),
    path('qualifications', tutor_views.qualifications),
    path('qualifications/<int:document_id>', tutor_views.qualification_detail),
    path('availability', tutor_views.availability),
    path('availability/check-conflict', tutor_views.check_conflict),
    path('classes/open', tutor_views.open_classes),
    path('classes/open/<int:class_id>', tutor_views.open_class_detail),
    path('classes/active', tutor_views.active_classes),
    path('classes/<int:class_id>', tutor_views.teaching_class_detail),
    path('classes/<int:class_id>/applications', tutor_views.apply_class),
    path('applications', tutor_views.applications),
    path('applications/<int:application_id>', tutor_views.application_detail),
    path('timetable', tutor_views.timetable),
    path('classes/<int:class_id>/teaching-logs', tutor_views.teaching_logs_by_class),
    path('teaching-logs/<int:log_id>', tutor_views.teaching_log_detail),
    path('classes/<int:class_id>/absence-requests', tutor_views.create_absence),
    path('absence-requests', tutor_views.absence_requests),
    path('absence-requests/<int:request_id>', tutor_views.absence_detail),
    path('absence-requests/<int:request_id>/cancel', tutor_views.cancel_absence),
    path('refund-requests', tutor_views.refund_requests),
    path('refund-requests/<int:refund_request_id>', tutor_views.refund_detail),
    path('refund-requests/<int:refund_request_id>/cancel', tutor_views.cancel_refund),
    path('receiving-fees', tutor_views.receiving_fees),
    path('receiving-fees/<int:fee_id>', tutor_views.receiving_fee_detail),
    path('reviews', tutor_views.reviews),
    path('notifications', tutor_views.notifications),
    path('notifications/<int:notification_id>/read', tutor_views.mark_read),
    path('notifications/read-all', tutor_views.mark_read),
]

urlpatterns = [
    path('register/student/', register_views.register_student),
    path('register/tutor/', register_views.register_tutor),
    path('register/staff/', register_views.register_staff),
    path('', include(router.urls)),
]
