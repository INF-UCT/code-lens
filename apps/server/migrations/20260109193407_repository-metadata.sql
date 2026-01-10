CREATE TABLE repositories(
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    owner TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);