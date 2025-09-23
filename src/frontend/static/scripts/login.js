// Sélection des rôles
const roleCards = document.querySelectorAll(".role-card");
const roleInput = document.getElementById("role");
 
roleCards.forEach(card => {
    card.addEventListener("click", () => {
        // Supprime la sélection précédente
        roleCards.forEach(c => c.classList.remove("selected"));
       
        // Ajoute la sélection à l'élément cliqué
        card.classList.add("selected");
       
        // Stocke le rôle dans l'input caché
        roleInput.value = card.dataset.role;
    });
});
 
 