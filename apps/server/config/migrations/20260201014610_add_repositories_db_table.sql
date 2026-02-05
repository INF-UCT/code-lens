CREATE TABLE repositories(
	id UUID PRIMARY KEY,
	name TEXT UNIQUE NOT NULL,
	url TEXT NOT NULL,
	owner_id UUID REFERENCES users(id),
	default_branch TEXT NOT NULL,
	last_commit_sha TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_repositories_name ON repositories(name);
