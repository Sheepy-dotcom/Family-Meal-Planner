import type { Ingredient } from '../types.js';

/**
 * The ingredient catalogue is the join point between recipes and the shop.
 * Every recipe references ingredients by id, so allergen data, aisle grouping
 * and (later) retailer product mapping are defined in exactly one place.
 *
 * `allergens` here is inherent to the ingredient. It is NOT a substitute for
 * reading the pack — see README, "Allergens are advisory".
 */

function ing(
  id: string,
  name: string,
  aisle: Ingredient['aisle'],
  extra: Partial<Ingredient> = {},
): Ingredient {
  return { id, name, aisle, allergens: [], ...extra };
}

export const INGREDIENTS: Ingredient[] = [
  // --- Produce ------------------------------------------------------------
  ing('onion', 'Onions', 'produce', { pack: { amount: 3, unit: 'unit' }, gramsPerUnit: 150 }),
  ing('red-onion', 'Red onions', 'produce', { pack: { amount: 3, unit: 'unit' }, gramsPerUnit: 150 }),
  ing('garlic', 'Garlic', 'produce', { pack: { amount: 1, unit: 'unit' }, staple: true }),
  ing('carrot', 'Carrots', 'produce', { pack: { amount: 750, unit: 'g' }, gramsPerUnit: 80 }),
  ing('potato', 'Potatoes', 'produce', { pack: { amount: 2000, unit: 'g' }, gramsPerUnit: 220 }),
  ing('sweet-potato', 'Sweet potatoes', 'produce', { pack: { amount: 1000, unit: 'g' } }),
  ing('tomato', 'Tomatoes', 'produce', { pack: { amount: 400, unit: 'g' }, gramsPerUnit: 100 }),
  ing('cherry-tomato', 'Cherry tomatoes', 'produce', { pack: { amount: 300, unit: 'g' } }),
  ing('cucumber', 'Cucumber', 'produce', { pack: { amount: 1, unit: 'unit' }, gramsPerUnit: 350 }),
  ing('lettuce', 'Little gem lettuce', 'produce', { pack: { amount: 2, unit: 'unit' } }),
  ing('rocket', 'Rocket', 'produce', { pack: { amount: 100, unit: 'g' } }),
  ing('spinach', 'Spinach', 'produce', { pack: { amount: 260, unit: 'g' } }),
  ing('broccoli', 'Broccoli', 'produce', { pack: { amount: 350, unit: 'g' } }),
  ing('courgette', 'Courgettes', 'produce', { pack: { amount: 2, unit: 'unit' }, gramsPerUnit: 200 }),
  ing('pepper-red', 'Red peppers', 'produce', { pack: { amount: 3, unit: 'unit' }, gramsPerUnit: 160 }),
  ing('mushroom', 'Chestnut mushrooms', 'produce', { pack: { amount: 250, unit: 'g' } }),
  ing('spring-onion', 'Spring onions', 'produce', { pack: { amount: 1, unit: 'unit' } }),
  ing('lemon', 'Lemons', 'produce', { pack: { amount: 4, unit: 'unit' }, gramsPerUnit: 100 }),
  ing('lime', 'Limes', 'produce', { pack: { amount: 4, unit: 'unit' } }),
  ing('ginger', 'Root ginger', 'produce', { pack: { amount: 100, unit: 'g' } }),
  ing('chilli', 'Red chillies', 'produce', { pack: { amount: 3, unit: 'unit' } }),
  ing('avocado', 'Avocados', 'produce', { pack: { amount: 2, unit: 'unit' } }),
  ing('banana', 'Bananas', 'produce', { pack: { amount: 5, unit: 'unit' }, gramsPerUnit: 120 }),
  ing('apple', 'Apples', 'produce', { pack: { amount: 6, unit: 'unit' } }),
  ing('berries', 'Mixed berries', 'produce', { pack: { amount: 300, unit: 'g' } }),
  ing('coriander', 'Fresh coriander', 'produce', { pack: { amount: 30, unit: 'g' } }),
  ing('parsley', 'Flat-leaf parsley', 'produce', { pack: { amount: 30, unit: 'g' } }),
  ing('basil', 'Fresh basil', 'produce', { pack: { amount: 30, unit: 'g' } }),
  ing('mint', 'Fresh mint', 'produce', { pack: { amount: 30, unit: 'g' } }),

  // --- Meat & fish --------------------------------------------------------
  ing('chicken-thigh', 'Chicken thighs, boneless', 'meat-fish', { pack: { amount: 600, unit: 'g' } }),
  ing('chicken-breast', 'Chicken breasts', 'meat-fish', { pack: { amount: 640, unit: 'g' } }),
  ing('beef-mince', 'Beef mince, 12% fat', 'meat-fish', { pack: { amount: 500, unit: 'g' } }),
  ing('steak', 'Sirloin steaks', 'meat-fish', { pack: { amount: 2, unit: 'unit' }, gramsPerUnit: 225 }),
  ing('beef-burger', 'Beef burgers', 'meat-fish', { pack: { amount: 4, unit: 'unit' } }),
  ing('sausage', 'Pork sausages', 'meat-fish', { pack: { amount: 6, unit: 'unit' }, allergens: ['gluten', 'sulphites'] }),
  ing('salmon-fillet', 'Salmon fillets', 'meat-fish', { pack: { amount: 4, unit: 'unit' }, gramsPerUnit: 120, allergens: ['fish'] }),
  ing('white-fish', 'Cod loin', 'meat-fish', { pack: { amount: 2, unit: 'unit' }, gramsPerUnit: 140, allergens: ['fish'] }),
  ing('prawns', 'King prawns, raw', 'meat-fish', { pack: { amount: 200, unit: 'g' }, allergens: ['crustaceans'] }),
  ing('tinned-tuna', 'Tuna chunks in spring water', 'ambient', { pack: { amount: 145, unit: 'g' }, allergens: ['fish'] }),
  ing('smoked-mackerel', 'Smoked mackerel fillets', 'meat-fish', { pack: { amount: 2, unit: 'unit' }, gramsPerUnit: 90, allergens: ['fish'] }),

  ing('smoked-haddock', 'Smoked haddock fillets', 'meat-fish', { pack: { amount: 300, unit: 'g' }, allergens: ['fish'] }),
  ing('tinned-sardines', 'Sardines in olive oil', 'ambient', { pack: { amount: 120, unit: 'g' }, allergens: ['fish'] }),
  ing('whole-chicken', 'Whole chicken', 'meat-fish', { pack: { amount: 1, unit: 'unit' }, gramsPerUnit: 1600 }),
  ing('lamb-mince', 'Lamb mince', 'meat-fish', { pack: { amount: 500, unit: 'g' } }),
  ing('pork-mince', 'Pork mince', 'meat-fish', { pack: { amount: 500, unit: 'g' } }),
  ing('green-beans', 'Green beans', 'produce', { pack: { amount: 220, unit: 'g' } }),
  ing('butternut-squash', 'Butternut squash', 'produce', { pack: { amount: 750, unit: 'g' } }),
  ing('risotto-rice', 'Arborio rice', 'ambient', { pack: { amount: 500, unit: 'g' } }),
  ing('borlotti-beans', 'Borlotti beans', 'ambient', { pack: { amount: 400, unit: 'g' } }),
  ing('butter-beans', 'Butter beans', 'ambient', { pack: { amount: 400, unit: 'g' } }),

  ing('tinned-mackerel', 'Mackerel fillets in tomato sauce', 'ambient', { pack: { amount: 125, unit: 'g' }, allergens: ['fish'] }),
  ing('salmon-hot-smoked', 'Hot-smoked salmon flakes', 'meat-fish', { pack: { amount: 120, unit: 'g' }, allergens: ['fish'] }),
  ing('sea-bass', 'Sea bass fillets', 'meat-fish', { pack: { amount: 2, unit: 'unit' }, gramsPerUnit: 120, allergens: ['fish'] }),
  ing('fish-pie-mix', 'Fish pie mix', 'meat-fish', { pack: { amount: 320, unit: 'g' }, allergens: ['fish'] }),
  ing('anchovies', 'Anchovy fillets', 'ambient', { pack: { amount: 50, unit: 'g' }, allergens: ['fish'] }),
  ing('chorizo', 'Cooking chorizo', 'meat-fish', { pack: { amount: 225, unit: 'g' }, allergens: ['sulphites'] }),
  ing('bacon', 'Smoked back bacon', 'meat-fish', { pack: { amount: 300, unit: 'g' } }),
  ing('gnocchi', 'Potato gnocchi', 'ambient', { pack: { amount: 500, unit: 'g' }, allergens: ['gluten'] }),
  ing('rice-noodles', 'Rice noodles', 'world-foods', { pack: { amount: 250, unit: 'g' } }),
  ing('gochujang', 'Gochujang paste', 'world-foods', { pack: { amount: 200, unit: 'g' }, gramsPerMl: 1.1, allergens: ['soya', 'gluten'] }),
  ing('miso', 'White miso paste', 'world-foods', { pack: { amount: 300, unit: 'g' }, gramsPerMl: 1.2, allergens: ['soya'] }),
  ing('fish-sauce', 'Fish sauce', 'world-foods', { pack: { amount: 200, unit: 'ml' }, allergens: ['fish'] }),
  ing('peanut-satay', 'Crunchy peanut butter', 'ambient', { pack: { amount: 340, unit: 'g' }, gramsPerMl: 1.0, allergens: ['peanuts'] }),
  ing('kimchi', 'Kimchi', 'world-foods', { pack: { amount: 300, unit: 'g' } }),
  ing('olives', 'Pitted green olives', 'ambient', { pack: { amount: 200, unit: 'g' }, allergens: ['sulphites'] }),
  ing('capers', 'Capers', 'ambient', { pack: { amount: 100, unit: 'g' } }),
  ing('sundried-tomato', 'Sun-dried tomatoes', 'ambient', { pack: { amount: 280, unit: 'g' }, allergens: ['sulphites'] }),
  ing('puff-pastry', 'Puff pastry sheet', 'frozen', { pack: { amount: 320, unit: 'g' }, allergens: ['gluten', 'milk'] }),
  ing('cannellini-beans', 'Cannellini beans', 'ambient', { pack: { amount: 400, unit: 'g' } }),
  ing('green-lentils', 'Cooked green lentils', 'ambient', { pack: { amount: 250, unit: 'g' } }),
  ing('aubergine', 'Aubergine', 'produce', { pack: { amount: 1, unit: 'unit' }, gramsPerUnit: 250 }),
  ing('leek', 'Leeks', 'produce', { pack: { amount: 500, unit: 'g' } }),
  ing('cauliflower', 'Cauliflower', 'produce', { pack: { amount: 1, unit: 'unit' }, gramsPerUnit: 600 }),
  ing('pak-choi', 'Pak choi', 'produce', { pack: { amount: 200, unit: 'g' } }),
  ing('beetroot', 'Cooked beetroot', 'produce', { pack: { amount: 250, unit: 'g' } }),
  ing('orange', 'Oranges', 'produce', { pack: { amount: 4, unit: 'unit' }, gramsPerUnit: 150 }),
  ing('dates', 'Medjool dates', 'produce', { pack: { amount: 250, unit: 'g' } }),
  ing('almonds', 'Flaked almonds', 'ambient', { pack: { amount: 100, unit: 'g' }, allergens: ['nuts'] }),
  ing('popcorn-kernels', 'Popcorn kernels', 'ambient', { pack: { amount: 500, unit: 'g' } }),
  ing('oatcakes', 'Oatcakes', 'bakery', { pack: { amount: 200, unit: 'g' }, gramsPerUnit: 11, allergens: ['gluten'] }),
  ing('rice-cakes', 'Rice cakes', 'bakery', { pack: { amount: 12, unit: 'unit' } }),
  ing('coconut-yoghurt', 'Coconut yoghurt', 'dairy-eggs', { pack: { amount: 350, unit: 'g' } }),
  ing('almond-milk', 'Almond milk', 'dairy-eggs', { pack: { amount: 1000, unit: 'ml' }, allergens: ['nuts'] }),
  ing('nut-butter-almond', 'Almond butter', 'ambient', { pack: { amount: 170, unit: 'g' }, gramsPerMl: 1.0, allergens: ['nuts'] }),
  ing('chia', 'Chia seeds', 'ambient', { pack: { amount: 200, unit: 'g' } }),
  ing('pumpkin-seeds', 'Pumpkin seeds', 'ambient', { pack: { amount: 200, unit: 'g' } }),

  ing('cottage-cheese', 'Cottage cheese', 'dairy-eggs', { pack: { amount: 300, unit: 'g' }, allergens: ['milk'] }),
  ing('cream-cheese', 'Cream cheese', 'dairy-eggs', { pack: { amount: 200, unit: 'g' }, allergens: ['milk'] }),
  ing('ham', 'Sliced ham', 'meat-fish', { pack: { amount: 120, unit: 'g' } }),
  ing('chicken-cooked', 'Cooked chicken slices', 'meat-fish', { pack: { amount: 200, unit: 'g' } }),
  ing('bagel', 'Bagels', 'bakery', { pack: { amount: 5, unit: 'unit' }, allergens: ['gluten', 'sesame'] }),
  ing('crackers', 'Wholegrain crackers', 'bakery', { pack: { amount: 200, unit: 'g' }, gramsPerUnit: 8, allergens: ['gluten'] }),
  ing('tortilla-chips', 'Tortilla chips', 'ambient', { pack: { amount: 200, unit: 'g' } }),
  ing('salsa', 'Tomato salsa', 'world-foods', { pack: { amount: 300, unit: 'g' }, gramsPerMl: 1.05 }),
  ing('guacamole', 'Guacamole', 'dairy-eggs', { pack: { amount: 200, unit: 'g' } }),
  ing('grapes', 'Grapes', 'produce', { pack: { amount: 500, unit: 'g' } }),
  ing('satsuma', 'Satsumas', 'produce', { pack: { amount: 6, unit: 'unit' }, gramsPerUnit: 90 }),
  ing('pear', 'Pears', 'produce', { pack: { amount: 4, unit: 'unit' }, gramsPerUnit: 170 }),
  ing('celery', 'Celery', 'produce', { pack: { amount: 1, unit: 'unit' }, gramsPerUnit: 400, allergens: ['celery'] }),
  ing('radish', 'Radishes', 'produce', { pack: { amount: 200, unit: 'g' } }),
  ing('sweetcorn-tin', 'Sweetcorn', 'ambient', { pack: { amount: 325, unit: 'g' } }),
  ing('raisins', 'Raisins', 'ambient', { pack: { amount: 500, unit: 'g' } }),
  ing('dark-chocolate', 'Dark chocolate', 'ambient', { pack: { amount: 100, unit: 'g' }, allergens: ['milk', 'soya'] }),
  ing('cocoa', 'Cocoa powder', 'ambient', { pack: { amount: 250, unit: 'g' }, gramsPerMl: 0.5, staple: true }),
  ing('cinnamon', 'Ground cinnamon', 'herbs-spices', { gramsPerMl: 0.45, pack: { amount: 40, unit: 'g' }, staple: true }),
  ing('sunflower-seeds', 'Sunflower seeds', 'ambient', { pack: { amount: 200, unit: 'g' } }),
  ing('baked-beans', 'Baked beans', 'ambient', { pack: { amount: 400, unit: 'g' } }),
  ing('crumpets', 'Crumpets', 'bakery', { pack: { amount: 6, unit: 'unit' }, allergens: ['gluten'] }),
  ing('frozen-berries', 'Frozen berries', 'frozen', { pack: { amount: 500, unit: 'g' } }),
  ing('soft-cheese-boursin', 'Garlic and herb soft cheese', 'dairy-eggs', { pack: { amount: 150, unit: 'g' }, allergens: ['milk'] }),

  // --- Dairy & eggs -------------------------------------------------------
  ing('egg', 'Free-range eggs', 'dairy-eggs', { pack: { amount: 6, unit: 'unit' }, allergens: ['eggs'] }),
  ing('milk', 'Semi-skimmed milk', 'dairy-eggs', { pack: { amount: 2000, unit: 'ml' }, allergens: ['milk'] }),
  ing('butter', 'Butter', 'dairy-eggs', { pack: { amount: 250, unit: 'g' }, allergens: ['milk'], staple: true }),
  ing('cheddar', 'Mature cheddar', 'dairy-eggs', { pack: { amount: 350, unit: 'g' }, allergens: ['milk'] }),
  ing('parmesan', 'Parmesan', 'dairy-eggs', { pack: { amount: 150, unit: 'g' }, allergens: ['milk'] }),
  ing('feta', 'Feta', 'dairy-eggs', { pack: { amount: 200, unit: 'g' }, allergens: ['milk'] }),
  ing('halloumi', 'Halloumi', 'dairy-eggs', { pack: { amount: 225, unit: 'g' }, allergens: ['milk'] }),
  ing('mozzarella', 'Mozzarella', 'dairy-eggs', { pack: { amount: 125, unit: 'g' }, allergens: ['milk'] }),
  ing('greek-yoghurt', 'Greek yoghurt', 'dairy-eggs', { pack: { amount: 500, unit: 'g' }, allergens: ['milk'] }),
  ing('creme-fraiche', 'Crème fraîche', 'dairy-eggs', { pack: { amount: 300, unit: 'g' }, allergens: ['milk'] }),

  // --- Bakery -------------------------------------------------------------
  ing('bread', 'Seeded wholemeal loaf', 'bakery', { pack: { amount: 800, unit: 'g' }, gramsPerUnit: 44, allergens: ['gluten', 'sesame'] }),
  ing('wrap', 'Tortilla wraps', 'bakery', { pack: { amount: 8, unit: 'unit' }, allergens: ['gluten'] }),
  ing('pitta', 'Wholemeal pittas', 'bakery', { pack: { amount: 6, unit: 'unit' }, allergens: ['gluten'] }),
  ing('burger-bun', 'Brioche burger buns', 'bakery', { pack: { amount: 4, unit: 'unit' }, allergens: ['gluten', 'eggs', 'milk', 'sesame'] }),

  // --- Ambient ------------------------------------------------------------
  ing('pasta-penne', 'Penne', 'ambient', { pack: { amount: 500, unit: 'g' }, allergens: ['gluten'] }),
  ing('pasta-spaghetti', 'Spaghetti', 'ambient', { pack: { amount: 500, unit: 'g' }, allergens: ['gluten'] }),
  ing('pasta-orzo', 'Orzo', 'ambient', { pack: { amount: 500, unit: 'g' }, allergens: ['gluten'] }),
  ing('rice-basmati', 'Basmati rice', 'ambient', { pack: { amount: 1000, unit: 'g' } }),
  ing('couscous', 'Couscous', 'ambient', { pack: { amount: 500, unit: 'g' }, allergens: ['gluten'] }),
  ing('noodles-egg', 'Medium egg noodles', 'ambient', { pack: { amount: 250, unit: 'g' }, allergens: ['gluten', 'eggs'] }),
  ing('oats', 'Porridge oats', 'ambient', { pack: { amount: 1000, unit: 'g' }, allergens: ['gluten'] }),
  // Standard oats carry a gluten flag because of shared milling. Certified
  // gluten-free oats are a separate product and a separate line on the list.
  ing('oats-gf', 'Gluten-free porridge oats', 'ambient', { pack: { amount: 450, unit: 'g' } }),
  ing('chopped-tomatoes', 'Chopped tomatoes', 'ambient', { pack: { amount: 400, unit: 'g' } }),
  ing('passata', 'Passata', 'ambient', { pack: { amount: 500, unit: 'g' } }),
  ing('tomato-puree', 'Tomato purée', 'ambient', { pack: { amount: 200, unit: 'g' }, gramsPerMl: 1.1, staple: true }),
  ing('chickpeas', 'Chickpeas', 'ambient', { pack: { amount: 400, unit: 'g' } }),
  ing('black-beans', 'Black beans', 'ambient', { pack: { amount: 400, unit: 'g' } }),
  ing('red-lentils', 'Red split lentils', 'ambient', { pack: { amount: 500, unit: 'g' } }),
  ing('chana-dhal', 'Chana dhal', 'world-foods', { pack: { amount: 500, unit: 'g' } }),
  ing('coconut-milk', 'Coconut milk', 'world-foods', { pack: { amount: 400, unit: 'ml' } }),
  ing('stock-chicken', 'Chicken stock cubes', 'ambient', { pack: { amount: 10, unit: 'unit' }, allergens: ['celery'], staple: true }),
  ing('stock-veg', 'Vegetable stock cubes', 'ambient', { pack: { amount: 10, unit: 'unit' }, allergens: ['celery'], staple: true }),
  ing('olive-oil', 'Olive oil', 'ambient', { pack: { amount: 750, unit: 'ml' }, staple: true }),
  ing('soy-sauce', 'Soy sauce', 'world-foods', { pack: { amount: 150, unit: 'ml' }, allergens: ['soya', 'gluten'] }),
  ing('sesame-oil', 'Toasted sesame oil', 'world-foods', { pack: { amount: 150, unit: 'ml' }, allergens: ['sesame'] }),
  ing('tahini', 'Tahini', 'world-foods', { pack: { amount: 270, unit: 'g' }, gramsPerMl: 1.0, allergens: ['sesame'] }),
  ing('harissa', 'Rose harissa', 'world-foods', { pack: { amount: 90, unit: 'g' }, gramsPerMl: 1.0 }),
  ing('curry-paste', 'Thai green curry paste', 'world-foods', { pack: { amount: 195, unit: 'g' }, gramsPerMl: 1.05, allergens: ['fish', 'crustaceans'] }),
  ing('honey', 'Honey', 'ambient', { pack: { amount: 340, unit: 'g' }, gramsPerMl: 1.42, staple: true }),
  ing('peanut-butter', 'Peanut butter', 'ambient', { pack: { amount: 340, unit: 'g' }, allergens: ['peanuts'] }),
  ing('mixed-nuts', 'Mixed nuts', 'ambient', { pack: { amount: 200, unit: 'g' }, allergens: ['nuts'] }),
  ing('mustard-dijon', 'Dijon mustard', 'ambient', { pack: { amount: 215, unit: 'g' }, gramsPerMl: 1.1, allergens: ['mustard', 'sulphites'], staple: true }),
  ing('flour-plain', 'Plain flour', 'ambient', { pack: { amount: 1500, unit: 'g' }, allergens: ['gluten'], staple: true }),

  // --- Meat substitutes ---------------------------------------------------
  ing('quorn-pieces', 'Quorn Vegan Pieces', 'frozen', { pack: { amount: 280, unit: 'g' } }),
  ing('quorn-mince', 'Quorn Meat Free Mince', 'frozen', { pack: { amount: 300, unit: 'g' }, allergens: ['eggs', 'milk'] }),

  // --- Frozen -------------------------------------------------------------
  ing('peas', 'Garden peas', 'frozen', { pack: { amount: 900, unit: 'g' }, staple: true }),
  ing('edamame', 'Edamame beans', 'frozen', { pack: { amount: 500, unit: 'g' }, allergens: ['soya'] }),
  ing('sweetcorn', 'Sweetcorn', 'frozen', { pack: { amount: 700, unit: 'g' } }),

  // --- Herbs & spices -----------------------------------------------------
  ing('cumin', 'Ground cumin', 'herbs-spices', { gramsPerMl: 0.45, pack: { amount: 40, unit: 'g' }, staple: true }),
  ing('paprika-smoked', 'Smoked paprika', 'herbs-spices', { gramsPerMl: 0.45, pack: { amount: 40, unit: 'g' }, staple: true }),
  ing('turmeric', 'Ground turmeric', 'herbs-spices', { gramsPerMl: 0.45, pack: { amount: 40, unit: 'g' }, staple: true }),
  ing('garam-masala', 'Garam masala', 'herbs-spices', { gramsPerMl: 0.45, pack: { amount: 40, unit: 'g' }, staple: true }),
  ing('oregano-dried', 'Dried oregano', 'herbs-spices', { gramsPerMl: 0.45, pack: { amount: 20, unit: 'g' }, staple: true }),
  ing('chilli-flakes', 'Chilli flakes', 'herbs-spices', { gramsPerMl: 0.45, pack: { amount: 40, unit: 'g' }, staple: true }),
  ing('salt', 'Sea salt', 'herbs-spices', { gramsPerMl: 1.2, pack: { amount: 500, unit: 'g' }, staple: true }),
  ing('pepper', 'Black pepper', 'herbs-spices', { gramsPerMl: 0.45, pack: { amount: 50, unit: 'g' }, staple: true }),
];

export const INGREDIENT_BY_ID: Map<string, Ingredient> = new Map(
  INGREDIENTS.map((i) => [i.id, i]),
);

export function getIngredient(id: string): Ingredient {
  const found = INGREDIENT_BY_ID.get(id);
  if (!found) throw new Error(`Unknown ingredient id: ${id}`);
  return found;
}
