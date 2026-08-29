function showMessage() {
    alert("Welcome to my GameZone!");
}

const cursorGlow = document.querySelector(".cursor-glow");
const grid = document.querySelector(".grid");

document.addEventListener("mousemove", function(event) {

    const mouseX = event.clientX;
    const mouseY = event.clientY;

    cursorGlow.style.left = mouseX + "px";
    cursorGlow.style.top = mouseY + "px";

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const offsetX = mouseX - centerX;
    const offsetY = mouseY - centerY;

    const gridX = offsetX * 0.08;
    const gridY = offsetY * 0.04;

    grid.style.setProperty("--mouse-x", gridX + "px");
    grid.style.setProperty("--mouse-y", gridY + "px");

});