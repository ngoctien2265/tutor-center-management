# Migration Summary: Remove Parent Model and Merge with Student

## Date: 2026-06-02

## Overview
Removed the separate `Parent` model and merged parent information directly into the `Student` model to simplify the data structure.

## Changes Made

### 1. Database Models

#### Student Model (`backend/apps/users/models/student.py`)
- **Removed**: `parent` foreign key relationship
- **Added**: 
  - `parent_name` (CharField, nullable)
  - `parent_phone` (CharField, nullable)
  - `parent_email` (EmailField, nullable)
  - `address` (TextField, nullable)
- **Updated**: `user` field now required (not nullable)
- **Updated**: Indexes changed from `(parent, grade_level)` to `(grade_level)` and `(parent_phone)`

#### Enrollment Model (`backend/apps/finance/models.py`)
- **Removed**: `parent_id` foreign key field
- **Updated**: Imports removed `Parent` reference

#### User Model Choices (`backend/apps/users/choices.py`)
- **Removed**: `parent` role from `USER_ROLE_CHOICES`
- **Roles now**: admin, staff, student, tutor

### 2. Serializers

#### Student Serializer (`backend/apps/users/serializers/student.py`)
- **Removed**: `ParentSerializer` import and usage
- **Updated**: `StudentCreateUpdateSerializer` fields to include:
  - `parent_name`, `parent_phone`, `parent_email`, `address`

#### Finance Serializers (`backend/apps/finance/serializers.py`)
- **Removed**: `ParentSerializer` import
- **Removed**: `parent_id` field from `EnrollmentSerializer`

#### Register Serializer (`backend/apps/users/serializers/register.py`)
- **Updated**: `StudentRegisterSerializer` to:
  - Store parent info directly in student model
  - Create user with role `student` instead of `parent`
  - Added `parentEmail` field

### 3. Views and API Endpoints

#### Admin Views (`backend/apps/users/views/admin.py`)
- **Removed**: `Parent` model import
- **Removed**: `parents()` endpoint
- **Removed**: `verify_parent()` endpoint
- **Removed**: `unverify_parent()` endpoint
- **Removed**: Parent role handling from `build_profile()`
- **Updated**: `student_sections()` to use student's parent fields directly
- **Updated**: `display_user_name()` removed parent profile check
- **Updated**: `create_user()` to create student with embedded parent info
- **Updated**: `update_user()` to update student with parent info
- **Updated**: `dashboard()` removed parents count
- **Updated**: `finance_summary()` changed query to use `user_id__student_profile`

#### URLs (`backend/apps/users/urls.py`)
- **Removed**: `/api/v1/admin/parents` endpoint
- **Removed**: `/api/v1/admin/parents/<id>/verify` endpoint
- **Removed**: `/api/v1/admin/parents/<id>/unverify` endpoint

### 4. Database Schema (DBML)

#### Updated `database.dbml`
- **Removed**: `parents` table entirely
- **Updated**: `students` table with new fields:
  - `parent_name`, `parent_phone`, `parent_email`, `address`
- **Updated**: `enrollments` table removed `parent_id` foreign key
- **Updated**: `users` table role note from 'admin, staff, student, tutor, parent' to 'admin, staff, student, tutor'
- **Updated**: Index definitions for students table

### 5. Migrations

#### Created New Migration Files
- `backend/apps/users/migrations/0006_remove_parent_merge_to_student.py`
  - Adds parent fields to Student model
  - Makes user field required
  - Removes parent foreign key
  - Updates indexes
  - Updates User role choices
  - Note: Does NOT delete the `Parent` model here (it would fail because `Enrollment.parent_id` still references it). The Parent model is deleted in `users.0007`.

- `backend/apps/users/migrations/0007_delete_parent_model.py`
  - Depends on `users.0006` AND `finance.0003` (which removes `Enrollment.parent_id`)
  - Deletes the `Parent` model after all FK references are gone

- `backend/apps/finance/migrations/0003_remove_enrollment_parent_id.py`
  - Removes parent_id from Enrollment model

### 6. Files Deleted
- `backend/apps/users/models/parent.py`
- `backend/apps/users/serializers/parent.py`

## Impact Analysis

### Affected Areas
1. **User Registration**: Student registration now creates a student user with embedded parent info
2. **Enrollment**: No longer tracks parent separately, linked only to student
3. **Transactions**: Parent name shown via student's user account
4. **Admin Dashboard**: Removed parent count statistic
5. **User Profiles**: Parent profile view removed, info shown in student profile

### Benefits
- **Simplified Data Model**: One less table and relationship to manage
- **Reduced Complexity**: No need to manage parent-student relationships
- **Easier Data Entry**: Parent info captured directly with student
- **Better Alignment**: Matches real-world usage where student account represents family

### Migration Path
1. Run migrations to update database schema
2. Existing parent data needs to be migrated to student records
3. Update any frontend code that references parent endpoints
4. Test all student-related functionality

## Next Steps

1. **Run Database Migrations**:
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

2. **Data Migration Script** (if needed):
   - Create script to copy existing parent data to student records
   - Update existing enrollments to remove parent_id references

3. **Frontend Updates**:
   - Remove parent-related components
   - Update student forms to include parent fields
   - Update API calls to remove parent endpoints

4. **Testing**:
   - Test student registration flow
   - Test enrollment creation
   - Test transaction display
   - Test admin user management
   - Test finance summary

## Notes
- The `customer` role in URLs remains (refers to students/parents using the system)
- AppShell routing for 'parent' role needs frontend update
- Any existing parent users in database will need data migration

## Additional Cleanup (this update)

Beyond the original migration work, the following cleanup was done so the project actually runs end-to-end after removing `Parent`:

### Backend
- **`backend/apps/users/management/commands/seed_db.py`**: fixed broken indentation in the `--clear` block so the command runs.
- **`backend/apps/users/views/staff.py`**: 
  - `students()` view: removed `parent` from `select_related`.
  - `_ensure_enrollment_transaction()`: now uses `enrollment.student_id.user` (parent info lives on the student now).
  - `finance()` view: removed `parent_id` / `parent_id__user` from `select_related`; the `parent` label is now derived from `student.parent_name` (fallback to student full name).
- **`backend/apps/users/migrations/0006_remove_parent_merge_to_student.py`**: 
  - Removed the `RemoveField('enrollment', 'parent_id')` operation (the `enrollment` model lives in the `finance` app, not `users`).
  - Removed the `DeleteModel('Parent')` operation (it would fail while `enrollments.parent_id` still references it).
  - Fixed the index name in `RemoveIndex` to the real one created in the initial migration (`users_stud_parent_grade_index`).
  - Renamed the new index names to a less-ambiguous form (`users_stud_grade_level_idx`, `users_stud_parent_phone_idx`).
- **`backend/apps/users/migrations/0007_delete_parent_model.py`** (new): depends on `users.0006` + `finance.0003` and finally deletes the `Parent` model.

### Frontend
- **`frontend/src/screens/Login.js`**: removed the `'parent'` role from `homeRouteForRole` and the `fallbackRole` heuristic; updated the demo account hint from `parent / parent123` to `student1 / student123`.
- **`frontend/src/components/AppShell.js`**: removed the `'parent'` role from `getHomeRoute()`.
- **`frontend/src/components/Navigation.js`**: removed `'parent'` from `roleLabels`, the customer link selector, the panel title, and the active-link logic. Renamed the panel title from "Phụ huynh Panel" to "Học viên Panel".
- **`frontend/src/screens/ListPage.css`**: renamed the orphan `.role-parent` class to `.role-student` (kept the same purple styling, since that's what the `student` badge is supposed to use).
- **`frontend/src/screens/Enrollments.js`**: replaced `enrollment.parent_id?.full_name` with `enrollment.student_id?.parent_name || enrollment.student_id?.full_name`.
- **`frontend/src/screens/Reports.js`**: rephrased the "Số học viên của phụ huynh" subtext to "Số học viên đã đăng ký" so the wording is consistent with the new model.

