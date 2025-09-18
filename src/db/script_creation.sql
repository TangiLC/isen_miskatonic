-- Création de la table UserRole
CREATE TABLE IF NOT EXISTS UserRole (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL UNIQUE
);
 
-- Création de la table User
CREATE TABLE IF NOT EXISTS User (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    login TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role_id INTEGER NOT NULL,
    FOREIGN KEY (role_id) REFERENCES UserRole(id)
);
 
-- Insertion des rôles de base
INSERT OR IGNORE INTO UserRole (role) VALUES
    ('admin'),
    ('teacher'),
    ('student'),
    ('user');
 