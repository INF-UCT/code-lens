CREATE TABLE repositories(
	id UUID PRIMARY KEY,
	name TEXT UNIQUE,
	url TEXT,
	owner_id UUID REFERENCES users(id),
	last_commit_sha TEXT
);

CREATE INDEX idx_repositories_name ON repositories(name);
