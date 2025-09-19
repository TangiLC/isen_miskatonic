import bcrypt

# Script pour hacher le mot de passe "pass123"
password = "pass123"

# Générer le salt et hacher le mot de passe
salt = bcrypt.gensalt()
hashed_password = bcrypt.hashpw(password.encode("utf-8"), salt)

print("🔐 Hashage du mot de passe 'pass123'")
print("=" * 50)
print(f"Mot de passe original: {password}")
print(f"Salt généré: {salt}")
print(f"Hash complet (à stocker en BDD): {hashed_password.decode('utf-8')}")
print("=" * 50)

# Test de vérification
print("\n🧪 Test de vérification:")
test_password = "pass123"
is_valid = bcrypt.checkpw(test_password.encode("utf-8"), hashed_password)
print(f"Vérification '{test_password}': {'✅ VALIDE' if is_valid else '❌ INVALIDE'}")

# Test avec mauvais mot de passe
wrong_password = "wrongpass"
is_invalid = bcrypt.checkpw(wrong_password.encode("utf-8"), hashed_password)
print(
    f"Vérification '{wrong_password}': {'✅ VALIDE' if is_invalid else '❌ INVALIDE'}"
)

print("\n📝 Pour insertion manuelle en BDD SQLite:")
print(
    f"UPDATE users SET password = '{hashed_password.decode('utf-8')}' WHERE id = YOUR_USER_ID;"
)
