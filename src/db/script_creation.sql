-- Création de la table UserRole
CREATE TABLE IF NOT EXISTS Roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL UNIQUE
);
 
-- Création de la table User
CREATE TABLE IF NOT EXISTS Users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role_id INTEGER NOT NULL,
    FOREIGN KEY (role_id) REFERENCES Roles(id)
);
 
-- Insertion des rôles de base
INSERT OR IGNORE INTO Roles (role) VALUES
    ('admin'),
    ('teacher'),
    ('student'),
    ('user');
 