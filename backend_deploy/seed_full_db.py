import random
from datetime import datetime, timedelta
from app.database.database import SessionLocal
from app.models.user import User
from app.models.role import Role
from app.models.organization import Organization
from app.models.session import Session as SessionModel
from app.models.enrollment import Enrollment
from app.models.attendance import AttendanceRecord
from app.models.fraud import FraudAnalysis
from app.core.security import hash_password

db = SessionLocal()

def get_or_create_org(name="Presenza University"):
    org = db.query(Organization).filter(Organization.org_name == name).first()
    if not org:
        org = Organization(org_name=name, org_type="University")
        db.add(org)
        db.commit()
    return org

def seed_users(org_id):
    print("Seeding Users...")
    password = hash_password("password123")
    
    # 1. Admin
    if not db.query(User).filter(User.email == "admin@presenza.ai").first():
        db.add(User(full_name="System Admin", email="admin@presenza.ai", password_hash=password, role_id=1, org_id=org_id))
    
    # 2. Teachers
    teachers = []
    for i in range(1, 4):
        email = f"teacher{i}@presenza.ai"
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(full_name=f"Professor {chr(64+i)}", email=email, password_hash=password, role_id=2, org_id=org_id)
            db.add(user)
            db.commit()
        teachers.append(user)
        
    # 3. Students
    students = []
    for i in range(1, 51):
        email = f"student{i}@presenza.ai"
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(full_name=f"Student {i}", email=email, password_hash=password, role_id=3, org_id=org_id)
            db.add(user)
            db.commit()
        students.append(user)
        
    return teachers, students

def seed_classes(teachers):
    print("Seeding Classes...")
    subjects = ["CS101: Intro to AI", "CS102: Data Structures", "MAT201: Linear Algebra", "HIS101: World History", "PHY101: Mechanics"]
    
    classes = []
    # Create a recurring schedule for last 30 days
    start_date = datetime.utcnow() - timedelta(days=30)
    
    for subject in subjects:
        teacher = random.choice(teachers)
        # Create sessions for this subject every 2 days
        current = start_date
        while current < datetime.utcnow():
            # Session is 1 hour
            end_time = current + timedelta(hours=1)
            
            # Check duplicates handled by logic or just add? 
            # We'll just add distinct sessions
            session = SessionModel(
                session_name=subject,
                start_time=current,
                end_time=end_time,
                created_by=teacher.user_id,
                org_id=teacher.org_id
            )
            db.add(session)
            classes.append(session)
            current += timedelta(days=2) # Next class in 2 days
            
    db.commit()
    return classes

def seed_enrollments(students, classes):
    print("Seeding Enrollments...")
    # Get unique class names/groups logic if needed, but for now:
    # Each student enrolls in 3 random subjects (groups of sessions)
    # Actually, enrollment is usually per COURSE, but our model might link to Session?
    # Let's check model... Enrollment links to Session? Or Course?
    # If Enrollment is per session, that's heavy. 
    # Usually Enrollment -> Course. But our Session model has session_name.
    # We will enroll students in ALL sessions of a "Subject" (session_name).
    
    # Correction: Enrollment model links to session_id?
    # If yes, we need to add enrollment for every session.
    
    # Check Enrollment model
    # Assuming Enrollment(user_id, session_id)
    
    # Strategy: Pick 1 session ID as "Master" or just loop all?
    # Loop all sessions.
    
    sessions = db.query(SessionModel).all()
    
    for session in sessions:
        # Randomly pick 20 students for this session
        attendees = random.sample(students, 20)
        for student in attendees:
            exists = db.query(Enrollment).filter(Enrollment.user_id == student.user_id, Enrollment.session_id == session.session_id).first()
            if not exists:
                db.add(Enrollment(user_id=student.user_id, session_id=session.session_id, enrolled_at=datetime.utcnow()))
        db.commit()

def seed_attendance():
    print("Seeding Attendance...")
    # For all completed sessions, generate attendance
    sessions = db.query(SessionModel).filter(SessionModel.end_time < datetime.utcnow()).all()
    
    for session in sessions:
        enrollments = db.query(Enrollment).filter(Enrollment.session_id == session.session_id).all()
        for enroll in enrollments:
            # Random status
            rand = random.random()
            status = "Present" if rand > 0.2 else ("Absent" if rand > 0.1 else "Late")
            
            exists = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == session.session_id, AttendanceRecord.user_id == enroll.user_id).first()
            if not exists:
                rec = AttendanceRecord(
                    session_id=session.session_id,
                    user_id=enroll.user_id,
                    final_status=status,
                    final_score=0.9 if status == "Present" else 0.0,
                    decision_time=session.start_time + timedelta(minutes=random.randint(0, 60))
                )
                db.add(rec)
                
                # Random fraud?
                if status == "Present" and random.random() < 0.05:
                    db.flush() # get ID
                    fraud = FraudAnalysis(
                        attendance_id=rec.attendance_id,
                        fraud_score=0.85,
                        fraud_reason="Multiple faces detected",
                        flagged=True
                    )
                    db.add(fraud)
                    
        db.commit()

def main():
    org = get_or_create_org()
    teachers, students = seed_users(org.org_id)
    # Reload from DB to ensure attached
    teachers = db.query(User).filter(User.role_id == 2).all()
    students = db.query(User).filter(User.role_id == 3).all()
    
    seed_classes(teachers)
    seed_enrollments(students, [])
    seed_attendance()
    print("Database seeding complete!")

if __name__ == "__main__":
    main()
