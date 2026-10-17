// Bölüm doğrudan (kayıtsız) başlatılınca verilen hazır eşyalar
export function applyLoadout(level, inventory, player) {
  if (level === 2) {
    inventory.addWeapon('pistol', 36);
    inventory.select(1);
  } else if (level === 3) {
    inventory.addWeapon('pistol', 36);
    inventory.addWeapon('shotgun', 24);
    inventory.addWeapon('smg', 120);
    inventory.addItem('grenade', 3);
    inventory.addItem('c4', 2);
    inventory.select(3);
    player.armor = 50;
  } else if (level === 4) {
    inventory.addWeapon('pistol', 36);
    inventory.addWeapon('shotgun', 24);
    inventory.addWeapon('smg', 150);
    inventory.addWeapon('rocket', 6);
    inventory.addItem('grenade', 4);
    inventory.addItem('tnt', 2);
    inventory.select(3);
    player.armor = 100;
  }
}
