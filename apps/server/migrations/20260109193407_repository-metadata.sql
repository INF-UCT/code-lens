CREATE TABLE repositories(
    name TEXT NOT NULL,
    owner TEXT NOT NULL,
    url TEXT NOT NULL,
    PRIMARY KEY (name, owner),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tokens(
    id UUID PRIMARY KEY,
    token TEXT NOT NULL,
    repository_url TEXT NOT NULL,
    refresh_count INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
