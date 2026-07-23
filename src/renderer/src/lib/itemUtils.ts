import itemsData from '@shared/items_data.json';

export function getItemIcon(name: string) {
  if (!name) return "";
  const n = name.toLowerCase();
  
  if (n === 'poké ball' || n === 'poke ball') return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png";
  if (n === 'great ball') return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/great-ball.png";
  if (n === 'super ball') return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/safari-ball.png";
  if (n === 'ultra ball') return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ultra-ball.png";
  if (n === 'master ball') return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/master-ball.png";
  if (n === 'idle ball') return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/cherish-ball.png";

  const found = (itemsData as any[]).find((i: any) => i.name.toLowerCase() === n);
  if (found && found.icon) return found.icon;
  
  if (n.includes('pheromone')) return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/sweet-heart.png";
  if (n.includes('fragment')) return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/star-piece.png";
  if (n.includes('revive') || n.includes('potion')) return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/potion.png";
  if (n.includes('stone')) return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/hard-stone.png";
  
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${n.replace(/é/g, 'e').replace(/\s+/g, '-')}.png`;
}
