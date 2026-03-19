from alembic import op
import sqlalchemy as sa
from datetime import datetime

revision = '001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'workers',
        sa.Column('id', sa.String, primary_key=True),
        sa.Column('name', sa.String),
        sa.Column('email', sa.String, unique=True),
        sa.Column('current_role', sa.String),
        sa.Column('progress_pct', sa.Float, default=0),
        sa.Column('password_hash', sa.String),
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow),
        sa.Column('updated_at', sa.DateTime, default=datetime.utcnow),
    )
    
    op.create_table(
        'credentials',
        sa.Column('id', sa.String, primary_key=True),
        sa.Column('title', sa.String),
        sa.Column('description', sa.String),
        sa.Column('demand_score', sa.Float),
        sa.Column('skills_taught', sa.String),
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow),
    )
    
    op.create_table(
        'worker_credentials',
        sa.Column('id', sa.String, primary_key=True),
        sa.Column('worker_id', sa.String, sa.ForeignKey('workers.id')),
        sa.Column('credential_id', sa.String, sa.ForeignKey('credentials.id')),
        sa.Column('progress_pct', sa.Float, default=0),
        sa.Column('status', sa.String, default='enrolled'),
        sa.Column('started_at', sa.DateTime, default=datetime.utcnow),
        sa.Column('updated_at', sa.DateTime, default=datetime.utcnow),
    )
    
    op.create_table(
        'notifications',
        sa.Column('id', sa.String, primary_key=True),
        sa.Column('worker_id', sa.String, sa.ForeignKey('workers.id')),
        sa.Column('type', sa.String),
        sa.Column('message', sa.String),
        sa.Column('read', sa.Boolean, default=False),
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow),
    )
    
    op.create_table(
        'analytics_events',
        sa.Column('id', sa.String, primary_key=True),
        sa.Column('worker_id', sa.String, sa.ForeignKey('workers.id')),
        sa.Column('event_type', sa.String),
        sa.Column('event_data', sa.String),
        sa.Column('timestamp', sa.DateTime, default=datetime.utcnow),
    )

def downgrade():
    op.drop_table('analytics_events')
    op.drop_table('notifications')
    op.drop_table('worker_credentials')
    op.drop_table('credentials')
    op.drop_table('workers')
