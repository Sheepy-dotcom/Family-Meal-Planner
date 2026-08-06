/**
 * Detailed cooking guides, keyed by recipe id.
 *
 * The concise `method` on each recipe is the at-a-glance version. This is the
 * fuller, beginner-friendly walkthrough shown behind the "detailed guide"
 * toggle on the recipe screen — the cues, temperatures and timings a confident
 * cook takes for granted. Kept in its own file so the recipe catalogue stays
 * readable and guides can be added without touching recipe data.
 *
 * The registry attaches these to recipes that do not already carry an inline
 * `guide`, so a recipe can still define one directly if it prefers.
 */
export const RECIPE_GUIDES: Record<string, string[]> = {
  "apple-cheddar": [
    "Choose crisp apples and give them a quick rinse and dry, then quarter and core them.",
    "Slice the apple thinly so each piece is easy to eat and pairs neatly with the cheese.",
    "Cut the mature cheddar into thin slices roughly the same size as the apple, so the two sit together well.",
    "If the slices will sit for a while, a light squeeze of any citrus or a quick dip in cold water helps keep the apple from browning, though eaten soon it is fine as is.",
    "Arrange the apple and cheddar together on a plate or in boxes and eat a slice of each together."
  ],
  "apple-peanut-butter": [
    "Rinse and dry the apples, then core them, standing each one up and cutting down around the core into wedges.",
    "Slice the apples into even wedges so they are sturdy enough to scoop up the peanut butter without snapping.",
    "If they are not being eaten straight away, keep the slices from browning with a light squeeze of citrus or a moment in cold water, then pat dry.",
    "Spoon the peanut butter into a small bowl for dipping, or loosen it with a few drops of warm water if it is very stiff.",
    "Arrange the apple slices around the peanut butter and serve, dipping each slice as you eat."
  ],
  "aubergine-parmigiana": [
    "Cut the aubergines lengthways into slices about 1cm thick, brush lightly with oil and season, then griddle or fry in batches for a few minutes each side until soft and marked with dark stripes.",
    "Meanwhile, peel and finely slice the garlic and simmer it with the passata in a pan for 15 minutes until thickened and no longer tasting raw, seasoning with salt and pepper.",
    "Stir most of the basil into the sauce and heat the oven to 190C/170C fan.",
    "Spread a little sauce over the base of a baking dish, then layer up the aubergine, more sauce and torn mozzarella, repeating until everything is used and finishing with sauce.",
    "Scatter the grated parmesan over the top and bake for 40 minutes until bubbling and golden.",
    "Let it settle for 10 minutes so the layers firm up, then scatter with the remaining basil before serving."
  ],
  "avocado-toast-seeds": [
    "Toast the pumpkin seeds in a dry frying pan over a medium heat for a couple of minutes, shaking often, until they smell nutty and start to pop, then tip out to cool.",
    "Halve and stone the avocados, scoop the flesh into a bowl and add a good squeeze of lemon juice, a pinch of salt and the chilli flakes.",
    "Smash with a fork to your liking, leaving it a little chunky rather than completely smooth.",
    "Taste and adjust with more lemon or salt as needed.",
    "Toast the slices of seeded loaf until golden and crisp.",
    "Pile the smashed avocado onto the toast and scatter over the toasted pumpkin seeds."
  ],
  "bacon-leek-pasta": [
    "Bring a large pan of salted water to the boil and cook the penne for the time on the packet until just tender, then drain, keeping a mugful of the cooking water.",
    "While the pasta cooks, chop the bacon and fry it in a dry pan over a medium heat for 4 to 5 minutes until crisp and the fat has rendered.",
    "Trim, halve and slice the leeks, rinse off any grit, then add them to the bacon and soften gently for about 5 minutes until they collapse but keep their colour.",
    "Stir in the drained, rinsed cannellini beans and the crème fraîche and warm through until the sauce is creamy.",
    "Add the drained pasta and most of the grated parmesan, tossing together and loosening with a splash of the reserved pasta water until the sauce clings to the penne.",
    "Season with pepper, then serve with the last of the parmesan scattered over."
  ],
  "bagel-cream-cheese": [
    "Slice the bagels in half through the middle and toast the cut sides until golden.",
    "While they toast, slice the tomatoes into thin rounds and finely slice the spring onion.",
    "Spread the toasted bagel halves thickly with cream cheese, right to the edges.",
    "Lay the tomato slices over the cream cheese and season with a little salt and black pepper.",
    "Scatter over the spring onion and serve while the bagels are still warm."
  ],
  "banana-oat-pancakes": [
    "Peel the bananas and break them into a blender or bowl, choosing ripe, spotty ones as they blend smoothly and sweeten the batter.",
    "Add the oats, eggs and milk and blitz to a smooth batter; let it stand for a couple of minutes so the oats soften and thicken it slightly.",
    "Melt a little of the butter in a non-stick frying pan over a medium heat until it foams.",
    "Spoon in small rounds of batter, spacing them apart, and cook for about 2 minutes until bubbles appear on top and the underside is golden.",
    "Flip each one carefully and cook for another 2 minutes until set through and golden on the second side.",
    "Wipe the pan and add a little more butter between batches, keeping the cooked pancakes warm while you finish the rest."
  ],
  "beans-on-toast": [
    "Tip the baked beans into a pan and warm through over a medium heat, stirring now and then so they do not catch on the bottom.",
    "While the beans heat, toast the slices of seeded wholemeal loaf until golden.",
    "Grate the cheddar so it is ready to melt into the hot beans.",
    "Once the beans are steaming hot, pile them generously onto the toast.",
    "Grate the cheese over the top so it softens in the heat, add a little black pepper and serve straight away."
  ],
  "beef-chilli": [
    "Peel and chop the onion, and deseed and dice the red peppers.",
    "Heat a little oil in a large heavy pan and brown the mince hard over a high heat, breaking it up and letting it colour properly for good depth of flavour.",
    "Stir in the onion, peppers, cumin and smoked paprika and cook for a few minutes until the vegetables soften and the spices smell fragrant.",
    "Tip in the chopped tomatoes and the drained beans, season, and bring to a gentle simmer.",
    "Cook, uncovered and stirring now and then, for about 45 minutes until the chilli is dark, thick and rich; add a splash of water if it looks dry.",
    "Near the end, cook the rice in plenty of boiling salted water until tender, drain, and serve alongside the chilli."
  ],
  "boiled-eggs-snack": [
    "Lower the eggs gently into a pan of gently boiling water using a spoon, so they do not crack against the base.",
    "Boil for 8 minutes for a just-set yolk, keeping the water at a steady simmer rather than a rolling boil so the shells stay intact.",
    "Drain and cool the eggs quickly under cold running water, which stops the cooking and makes them far easier to peel.",
    "Tap each egg all over and peel under a little running water, starting from the wider end where there is usually an air pocket.",
    "Halve the eggs lengthways and lay them cut side up on a plate.",
    "Dust with the sea salt and a little smoked paprika, seasoning lightly so the eggs still taste of themselves."
  ],
  "boiled-eggs-soldiers": [
    "Take the eggs out of the fridge a little early if you can, as fridge-cold eggs are more likely to crack.",
    "Bring a pan of water to a gentle, rolling boil, deep enough to cover the eggs.",
    "Lower the eggs in carefully on a spoon and set a timer for 5 minutes for runny yolks, keeping the water at a steady simmer.",
    "While the eggs cook, toast the seeded bread and spread generously with the butter.",
    "Cut the buttered toast into thin strips, or soldiers, ready for dipping.",
    "Lift the eggs into egg cups, slice off the tops, and serve straight away with the soldiers alongside."
  ],
  "breakfast-beans-eggs": [
    "Tip the drained cannellini beans into a pan with the passata and smoked paprika, add a splash of water and season with salt and pepper.",
    "Warm over a medium heat for 10 minutes, stirring now and then and crushing a few beans against the side, until thick and saucy.",
    "Meanwhile, bring a wide pan of water to a gentle simmer and, if you like, stir it to make a swirl before slipping in each egg.",
    "Poach the eggs for about 3 minutes until the whites are set but the yolks still soft, then lift out with a slotted spoon and rest on kitchen paper.",
    "Toast the slices of seeded loaf.",
    "Spoon the beans over the toast and top each portion with a poached egg, finishing with a little pepper."
  ],
  "caprese-gnocchi-bake": [
    "Heat the oven to 220C/200C fan and peel the garlic, leaving the cloves whole or lightly crushing them.",
    "Tip the gnocchi and cherry tomatoes into a roasting tin, add the garlic, drizzle over the olive oil and season with salt and pepper, then toss so the gnocchi are lightly coated.",
    "Spread everything into a single layer so it roasts rather than steams, then roast for 20 minutes until the tomatoes have burst and the gnocchi are turning golden at the edges.",
    "Take the tin out and give it a gentle stir, squashing a few of the softened tomatoes to make a loose sauce.",
    "Tear the mozzarella into pieces and dot it over the top, then return to the oven for 6 minutes until melted and just starting to colour.",
    "Tear over the basil leaves and serve straight from the tin."
  ],
  "cauliflower-chickpea-curry": [
    "Peel and finely chop the onion and break the cauliflower into bite-sized florets, then cook the basmati rice to serve alongside.",
    "Heat a little oil in a large pan and soften the onion over a medium heat for 6 to 8 minutes until translucent and sweet.",
    "Stir in the garam masala and turmeric and cook for 1 minute until fragrant, being careful not to let the spices catch.",
    "Add the cauliflower florets, chopped tomatoes and coconut milk, bring to a gentle simmer and cook for 20 minutes until the cauliflower is tender to the point of a knife.",
    "Stir in the drained, rinsed chickpeas and warm through for a few minutes, adding a splash of water if the sauce is thicker than you'd like.",
    "Season with salt to taste and serve with the rice."
  ],
  "celery-cheese-boats": [
    "Trim the ends off the celery, pull off any tough stringy bits from the outer stalks, then rinse and pat dry.",
    "Cut the stalks into batons about the length of your finger, keeping the natural groove that will hold the filling.",
    "Spoon the cream cheese into the groove of each baton, pressing it in gently with the back of the spoon so it stays put.",
    "Dot the raisins along the cream cheese, spacing them evenly so every bite gets a little sweetness.",
    "Arrange on a plate and serve, or chill briefly if you like the celery extra crisp."
  ],
  "chana-dhal": [
    "Rinse the chana dhal in a sieve until the water runs clearer, then tip it into a large pan with 1.2 litres of water and the ground turmeric.",
    "Bring to the boil, skim off any froth, then lower to a gentle simmer and cook for about 45 minutes, stirring now and then, until the lentils are soft and starting to break down.",
    "While it cooks, finely chop the onion, garlic and peeled ginger, and rinse the basmati rice ready to cook to your usual method.",
    "Fry the onion in a little oil over a medium heat until deep gold and soft, then add the garlic and ginger and cook another minute until fragrant, stirring so the garlic does not catch.",
    "Stir in the garam masala for 30 seconds to wake up the spice, then tip this tarka into the dhal along with the spinach.",
    "Stir until the spinach wilts, season well with salt, and loosen with a splash of hot water if it is thicker than you like, then serve with the rice."
  ],
  "cheese-grapes": [
    "Cut the mature cheddar into even cubes, roughly bite-sized, so they are easy to pick up and pair with a grape.",
    "Rinse the grapes under cold water and pat them dry, then pull them from their stalks.",
    "If serving to younger children, halve the grapes lengthways to make them safer and easier to eat.",
    "Pile the cheese and grapes together on a plate or divide between boxes, keeping them side by side rather than mixed so the cheese stays dry.",
    "Serve straight away, or cover and chill until needed and bring back to room temperature so the cheddar tastes fuller."
  ],
  "cheese-onion-tart": [
    "Trim, halve and slice the leeks, then rinse to remove any grit and soften them gently in a little butter over a medium heat for 10 minutes until sweet and tender, seasoning lightly.",
    "Heat the oven to 200C/180C fan and unroll the puff pastry onto a lined baking tray.",
    "Score a border about 2cm in from the edge with a knife, cutting only halfway through, so the rim can puff up around the filling.",
    "Mix the Dijon mustard into the crème fraîche and spread it inside the border, then spoon the softened leeks evenly on top and scatter over the grated cheddar.",
    "Beat the egg and brush it over the scored border to help it colour.",
    "Bake for 25 minutes until the pastry is deep golden and crisp underneath, then slice and serve."
  ],
  "chia-pudding": [
    "Tip the chia seeds into a bowl or jar and add the coconut yoghurt, almond milk and honey.",
    "Stir well for a minute, making sure no dry clumps of chia settle at the bottom, as these need the liquid to swell.",
    "Wait 5 minutes, then stir again to break up any seeds that have stuck together, which stops the pudding setting unevenly.",
    "Cover and chill overnight, or for at least 4 hours, until thick and set like a soft pudding.",
    "In the morning, stir once more and loosen with a splash more almond milk if it is thicker than you like.",
    "Spoon into bowls and top with the mixed berries."
  ],
  "chicken-avocado-wrap": [
    "Halve, stone and scoop the avocados into a bowl and mash roughly with a fork.",
    "Squeeze in the juice of the lime, add the yoghurt and a pinch of salt, and mix to a spreadable cream.",
    "Shred the little gem lettuce into thin ribbons.",
    "Lay the wraps out flat and spread the avocado mixture over each, leaving a clear border at the edge.",
    "Divide the chicken slices and shredded lettuce along the middle of each wrap.",
    "Fold in the sides, then roll up tightly from the bottom and cut in half to serve."
  ],
  "chicken-caesar-ish": [
    "Take the chicken breasts out of the fridge a few minutes early. If they are thick, slice through the middle to open them out so they cook evenly.",
    "Rub the chicken with a little oil and season with salt and pepper, then griddle over a medium-high heat for about 6 minutes a side, until firm and cooked through with no pink in the middle.",
    "Lift the chicken onto a board and leave it to rest for 5 minutes; this keeps it juicy. Slice into strips once rested.",
    "For the dressing, whisk the Greek yoghurt with the grated parmesan and a good squeeze of lemon juice, plus salt and pepper. Loosen with a little water until it just coats the back of a spoon.",
    "Chop the little gem, cherry tomatoes and avocado into small, similar-sized pieces so every forkful has a bit of each.",
    "Tip everything into a large bowl with the sliced chicken, spoon over the dressing and toss gently. Add the avocado last so it keeps its shape."
  ],
  "chicken-fajitas": [
    "Slice the chicken breasts into thin strips so they cook quickly and evenly, then pat them dry.",
    "Toss the chicken with the smoked paprika, ground cumin, a good pinch of salt and pepper, and a little oil until every strip is coated.",
    "Deseed and slice the red peppers, and peel and slice the red onion, keeping everything roughly the same size.",
    "Get a large frying pan or griddle hot with a little oil, then fry the chicken, peppers and onion hard for about 8 minutes, stirring only now and then so the edges char rather than steam.",
    "Check a thicker piece of chicken is white all the way through before taking the pan off the heat.",
    "Warm the wraps in a dry pan or the microwave, squeeze the lime over the chicken, and serve with the yoghurt for spooning."
  ],
  "chicken-katsu-noodles": [
    "Slice the chicken breasts into thin strips. Heat a little oil in a wok or large frying pan over a high heat.",
    "Stir-fry the chicken for about 6 minutes, keeping it moving, until golden all over and cooked through with no pink inside.",
    "Peel and finely grate or chop the ginger, cut the broccoli into small florets, and add both to the pan with a good splash of water.",
    "Cover or keep the heat high and steam for 3 minutes, until the broccoli is just tender but still bright green.",
    "Meanwhile, cook the egg noodles according to the packet, then drain.",
    "Toss the noodles into the pan with the edamame, soy sauce and sesame oil, and stir over the heat for a minute until everything is hot and well coated."
  ],
  "chicken-lemon-orzo": [
    "Cut the chicken thighs into large chunks and pat them dry, then season with salt and pepper; peel and finely slice the garlic.",
    "Heat a little oil in a wide pan and brown the chicken over a medium-high heat for a few minutes until golden on the outside, then lift it out onto a plate.",
    "Lower the heat, add the garlic to the same pan and soften for a minute without letting it colour.",
    "Stir in the orzo, then crumble in the stock cubes and pour in 800ml hot water; return the chicken and any juices to the pan.",
    "Simmer for about 10 minutes, stirring now and then so the orzo does not stick, until the pasta is tender and the chicken cooked through.",
    "Stir in the spinach a handful at a time until wilted, then finish with a good squeeze of lemon and most of the grated parmesan, scattering the rest on top."
  ],
  "chicken-noodle-jar": [
    "Peel and finely grate or thinly slice the root ginger, and cut the carrots into fine matchsticks or thin slices so they soften quickly when the hot water goes in.",
    "Separate the pak choi leaves and shred them, keeping the thicker stems thinly sliced so they are not tough at the bottom of the jar.",
    "Soak the rice noodles in just-boiled water for 3 to 4 minutes until bendy but still with a little bite, then drain well, as fully soft noodles will turn mushy later.",
    "Divide the noodles between four jars or lidded pots, then layer in the shredded chicken, carrots and pak choi.",
    "Add the ginger, a tablespoon of soy sauce split between the jars, and half a crumbled stock cube to each, keeping the seasoning near the top so it dissolves evenly.",
    "At lunchtime, pour in enough boiling water to cover everything, put the lid on and leave for 4 minutes, then stir well so the stock and soy mix through before eating."
  ],
  "chicken-traybake-harissa": [
    "Heat the oven to 200C/180C fan. Cut the sweet potatoes into wedges, leaving the skin on, and cut the red onions into thick wedges.",
    "Tip the chicken thighs, sweet potato and onion into a large roasting tin, add the rose harissa and the oil, and toss with your hands until everything is well coated.",
    "Spread out in a single layer so things roast rather than steam, then roast for 35 minutes, until the chicken is cooked and the sweet potato is tender.",
    "Drain and rinse the chickpeas, then stir them through the tin, scraping up the sticky bits from the base.",
    "Roast for a further 10 minutes, until the chickpeas are hot and a little crisp and the chicken is golden with no pink in the middle.",
    "Serve straight from the tin with the Greek yoghurt spooned over and the coriander torn on top."
  ],
  "chickpea-feta-salad": [
    "Drain and rinse the chickpeas in a sieve under cold water until they stop foaming, then shake off the excess.",
    "Chop the cucumber and cherry tomatoes into bite-sized pieces, and finely slice the red onion.",
    "Tip the chickpeas and chopped vegetables into a large bowl.",
    "Squeeze over the juice of the lemon, add the olive oil and a good pinch of salt and pepper, then toss everything together well.",
    "Crumble the feta over the top in rough chunks rather than stirring it all through, so you get pockets of it.",
    "Tear the mint leaves and scatter them over just before serving, so they stay fresh and green."
  ],
  "chocolate-oat-bites": [
    "Pit the medjool dates if they are not already stoned, and if they feel firm, soak them in warm water for a few minutes then drain, so they blitz to a soft paste.",
    "Put the oats, dates, cocoa powder and almond butter in a food processor and blitz until the mixture clumps together and holds when pressed between your fingers.",
    "If it stays crumbly, add a teaspoon of water at a time and blitz again, as the dates provide the stickiness that binds everything.",
    "Roll the mixture into walnut-sized balls with your hands, pressing firmly so they hold their shape.",
    "Finely chop the dark chocolate into small shards and press a few into the outside of each ball.",
    "Chill on a plate or in a tin for at least 30 minutes to firm up before eating, and keep any spare in the fridge."
  ],
  "chorizo-bean-soup": [
    "Slice the chorizo into small pieces, peel and chop the onion and carrot, and dissolve the stock cubes in 1.2 litres of boiling water.",
    "Put the chorizo into a cold, large pan and set over a medium heat, frying for a few minutes until it releases its coloured oil.",
    "Add the onion and carrot to the pan and soften in the chorizo oil for about 8 minutes, stirring, until they begin to turn tender.",
    "Stir in the smoked paprika, then add the chopped tomatoes, the drained cannellini beans and the stock.",
    "Simmer for 20 minutes until the vegetables are soft and the soup has taken on colour, then crush some of the beans against the side of the pan to thicken it.",
    "Season with salt and pepper to taste and serve hot."
  ],
  "chorizo-bean-stew": [
    "Slice the chorizo into coins about the thickness of a pound coin and put it into a cold, wide pan, then set it over a medium heat.",
    "Fry gently for about 4 minutes, stirring now and then, until the edges crisp and a deep orange oil runs out; this fat carries most of the flavour, so don't tip it away.",
    "Stir in the smoked paprika and let it cook for a few seconds, then pour in the passata and add the drained, rinsed butter beans.",
    "Bring to a gentle simmer and cook for 10 minutes, stirring occasionally, until the sauce thickens slightly and turns a richer red; add a splash of water if it looks too dry.",
    "Add the spinach a handful at a time, folding it through until it wilts down and softens, which takes only a minute or two.",
    "Season with salt and pepper to taste, then serve in bowls with slices of the seeded loaf for mopping up the sauce."
  ],
  "cod-chorizo-beans": [
    "Deseed and slice the red peppers, and thinly slice the garlic. Warm a little oil in a wide, deep frying pan over a medium heat.",
    "Soften the peppers and garlic for about 8 minutes, until the peppers are floppy and the garlic smells sweet rather than harsh.",
    "Stir in the smoked paprika and cook for a minute, then add the chopped tomatoes and the drained black beans.",
    "Simmer for about 15 minutes, stirring now and then, until the sauce has thickened and no longer looks watery. Season with salt and pepper.",
    "Season the cod loins and nestle them down into the beans, then cover the pan and cook gently for 10 minutes, until the fish is opaque and flakes easily.",
    "Roughly chop the parsley and scatter it over just before serving."
  ],
  "cottage-cheese-toast": [
    "Toast the slices of seeded wholemeal loaf until golden and firm enough to hold a topping.",
    "Halve the cherry tomatoes and season them with a pinch of salt to draw out their juice.",
    "Spoon a generous layer of cottage cheese over each piece of toast and spread it out.",
    "Arrange the halved tomatoes on top, cut side up.",
    "Scatter over the chilli flakes and plenty of black pepper, then serve straight away while the toast is crisp."
  ],
  "couscous-jar-salad": [
    "Tip the couscous into a bowl and pour over 300ml boiling stock, then cover and leave for 10 minutes until the liquid is absorbed.",
    "Fluff the couscous with a fork to separate the grains and let it cool a little.",
    "Squeeze the lemon into the base of your jars or tubs to make a simple dressing, and drain and rinse the chickpeas.",
    "Dice the cucumber and halve the cherry tomatoes, then finely chop the mint.",
    "Layer the jars starting with the lemon dressing, then the chickpeas, then the couscous, keeping the wetter grains off the dressing.",
    "Add the cucumber and tomatoes, crumble the feta on top and scatter over the mint, so nothing goes soggy until you tip it out and toss."
  ],
  "crackers-cottage-cheese": [
    "Lay the wholegrain crackers out on a board or plates, assembling them just before eating so they stay crisp rather than softening under the topping.",
    "Spoon a generous layer of cottage cheese onto each cracker, spreading it gently so it does not push over the edges.",
    "Cut the cucumber into thin slices or small dice and arrange a little on top of each cracker.",
    "Sprinkle over a small pinch of chilli flakes, going lightly as they build up quickly and are easy to overdo.",
    "Add a little salt and pepper if you like, then serve at once."
  ],
  "crumpets-nut-butter": [
    "Toast the crumpets, holey side up, until golden and crisp on top and warmed through.",
    "While they toast, peel and slice the bananas into thin rounds.",
    "Spread each warm crumpet with almond butter, letting it melt slightly into the holes.",
    "Lay the banana slices over the top so they overlap and cover the crumpet.",
    "Dust lightly with the ground cinnamon and serve straight away while warm."
  ],
  "edamame-salt": [
    "Bring a pan of water to a rolling boil; you do not need to salt it as the beans get salted afterwards.",
    "Tip in the edamame and boil for 4 minutes, until the beans inside feel tender when you squeeze a pod.",
    "Drain well in a colander and give it a shake to shed as much water as you can.",
    "Tip the hot beans into a bowl and scatter over the sea salt, tossing so it sticks to the damp pods.",
    "Serve warm, popping the beans straight from the pods and leaving the shells to one side."
  ],
  "egg-fried-rice": [
    "Rinse the basmati rice until the water runs clear, then cook in plenty of water until just tender. Drain well and spread out to cool; day-old rice from the fridge works best as it fries drier.",
    "Beat the eggs in a small bowl with a pinch of salt.",
    "Heat a little oil in a wok or large frying pan over a high heat until very hot, pour in the eggs and scramble quickly, then tip them onto a plate before they are fully set.",
    "Add a splash more oil to the hot wok and fry the cooled rice hard for about 4 minutes, keeping it moving so it catches a little but does not burn.",
    "Stir in the peas and the scrambled eggs, breaking the eggs into smaller pieces, and heat through for a minute.",
    "Pour in the soy sauce and sesame oil, scatter in the sliced spring onions, toss everything together and serve straight away."
  ],
  "egg-mayo-sandwich": [
    "Lower the eggs into a pan of gently boiling water and cook for 9 minutes for firm yolks, then drain and sit them in cold water until cool enough to handle.",
    "Peel the eggs carefully and tip them into a bowl.",
    "Trim and finely slice the spring onions.",
    "Crush the eggs with a fork, then mix in the crème fraîche, spring onions and plenty of black pepper, keeping some texture rather than mashing to a paste.",
    "Separate and wash the little gem leaves and pat them dry.",
    "Spread the egg mixture over half the slices of bread, top with lettuce, close with the remaining slices and cut in half to serve."
  ],
  "egg-salad-box": [
    "Cut the potatoes into even bite-sized chunks, put them in a pan of cold salted water, bring to the boil and simmer for 12 to 15 minutes until a knife slides in easily.",
    "For the eggs, lower them into a separate pan of gently boiling water and cook for 8 to 9 minutes for a set yolk, then drain both and cool under cold running water.",
    "Peel the eggs once cool, tapping and rolling them so the shell comes away cleanly, then halve them along with the cooled potatoes.",
    "In a small bowl, whisk the crème fraîche with the Dijon mustard, then chop the parsley finely and stir it through with a little salt and pepper.",
    "Slice the radishes thinly and separate the little gem leaves, giving them a rinse and a shake dry so no water dilutes the box.",
    "Pack the potatoes, eggs, radishes and lettuce into boxes and keep the dressing in a small separate pot, spooning it over only when you come to eat so nothing turns soggy."
  ],
  "eggs-avocado-tomato": [
    "Bring a pan of water to a rolling boil and lower in the eggs straight from the fridge using a spoon.",
    "Boil for exactly 7 minutes for a set white and just-soft yolk, then lift them into a bowl of cold water to stop them cooking.",
    "Halve and stone the avocados, scoop the flesh into a bowl and mash roughly with a fork.",
    "Squeeze in the juice of the lemon and season with salt and pepper, tasting as you go; the lemon keeps the avocado green as well as sharp.",
    "Halve the cherry tomatoes and peel the cooled eggs, then cut each egg in half.",
    "Share the smashed avocado, tomatoes and eggs between four plates and serve."
  ],
  "fish-finger-tacos": [
    "Heat the oven to 220C/200C fan and line a baking tray. Cut the cod loins into thick fingers.",
    "Toss the fish with the smoked paprika, a little oil, salt and pepper until evenly coated, then spread out on the tray and roast for 12 minutes, until opaque and cooked through.",
    "Meanwhile, finely shred the little gem lettuce.",
    "Dress the lettuce with the Greek yoghurt and a good squeeze of lime juice, plus a pinch of salt, to make a quick slaw.",
    "Slice the avocados and warm the tortilla wraps briefly, in a dry pan or under the grill, so they are soft and foldable.",
    "Build each taco with a little slaw, a few pieces of fish and some sliced avocado, then serve with lime wedges to squeeze over."
  ],
  "fish-pie": [
    "Heat the oven to 190C/170C fan. Peel and cut the potatoes into chunks, then boil in salted water until tender, about 15 minutes.",
    "Drain the potatoes well, then mash with most of the butter and a little salt and pepper until smooth.",
    "Slice the leeks and soften them in the remaining butter over a medium heat for about 8 minutes until soft but not coloured.",
    "Stir the creme fraiche and Dijon mustard into the leeks, then fold in the peas and the fish pie mix and warm gently for a minute.",
    "Season, tip into an ovenproof dish, and spread the mash over the top, forking the surface so it crisps.",
    "Scatter over the grated cheddar and bake for 35 minutes until bubbling at the edges and golden on top."
  ],
  "frittata": [
    "Heat the grill to medium and slice the courgettes into rounds; trim and slice the spring onions and roughly chop the mint.",
    "Heat a little oil in an ovenproof frying pan and fry the courgettes over a medium heat for about 8 minutes, turning, until golden and tender.",
    "Beat the eggs in a bowl with salt and pepper, then stir in the spring onions and most of the mint.",
    "Pour the eggs over the courgettes, tilting the pan so they spread evenly, and crumble the feta over the top.",
    "Cook on the hob over a low heat for about 5 minutes, until the edges are set but the middle is still a little loose.",
    "Slide the pan under the grill for about 5 minutes until puffed and just set, then scatter with the rest of the mint and cut into wedges."
  ],
  "frozen-berry-smoothie": [
    "Put the frozen berries, Greek yoghurt, oats, milk and honey into a blender.",
    "Blitz on high for a minute or so, until smooth and no bits of oat or berry skin remain.",
    "Check the consistency; if it is too thick to drink through a straw, pour in a little more milk and blitz again.",
    "Taste and add a touch more honey if the berries are sharp.",
    "Pour into glasses and drink straight away, before it separates."
  ],
  "gf-porridge-banana": [
    "Tip the gluten-free oats and milk into a medium pan with a small pinch of salt.",
    "Set over a medium heat and stir now and then as it comes up to a gentle simmer, so the oats do not stick to the base.",
    "Lower the heat and stir often for about 5 minutes, until the porridge is thick and creamy.",
    "If it gets too thick, loosen with a splash more milk or a little water until it drops easily from the spoon.",
    "Peel and slice the bananas while the porridge cooks.",
    "Divide the porridge between bowls, top with the sliced banana and finish with a little honey."
  ],
  "gochujang-noodles": [
    "Bring a pan of water to the boil and cook the egg noodles for the time on the packet, usually about 4 minutes, adding the halved pak choi for the final minute so it just softens.",
    "While that cooks, mix the gochujang, soy sauce and sesame oil in a small bowl with a spoonful of the noodle water to loosen it into a pourable sauce.",
    "Drain the noodles and pak choi, saving a little of the water, then return them to the warm pan and toss with the sauce until everything is well coated.",
    "Heat a little oil in a frying pan over a medium-high heat and crack in the eggs, frying for 2 to 3 minutes until the whites are set and the edges lacy but the yolks still soft.",
    "Trim and finely slice the spring onions.",
    "Divide the noodles between bowls, top each with a fried egg and scatter over the spring onions."
  ],
  "greek-pitta-pockets": [
    "Dice the cucumber and tomatoes into small, roughly even pieces, about the size of your fingernail, so the filling sits neatly in the pitta rather than tumbling out.",
    "Halve the green olives if they are whole, so no one gets a surprise stone or a mouthful that is too salty in one bite.",
    "Tip the cucumber, tomatoes and olives into a bowl, sprinkle over the dried oregano and a little salt and pepper, and toss so the herb coats everything.",
    "Warm the pittas briefly under the grill or in a toaster until just soft and pliable, then cut each one along the edge to open a pocket without splitting it in two.",
    "Spread the inside of each pocket with Greek yoghurt, which holds the salad in place and keeps the bread from going soggy too fast.",
    "Spoon the salad into the pockets, then crumble the feta over the top and press in gently before serving."
  ],
  "greek-salad-butterbeans": [
    "Cut the tomatoes into big, rough wedges and the cucumber into chunky half-moons; there is no need to peel it.",
    "Halve the red onion and slice it thinly, so it carries flavour without overpowering the salad.",
    "Drain and rinse the butter beans well, then tip them into a large bowl with the tomatoes, cucumber and onion.",
    "Pour over the olive oil, scatter in most of the oregano and a good pinch of salt and pepper, then fold everything together gently so the beans stay whole.",
    "Tip onto a serving plate and sit the whole slab of feta on top, rather than crumbling it in.",
    "Scatter with the remaining oregano and a final drizzle of oil, and let it sit for a few minutes before serving so the flavours settle."
  ],
  "guacamole-chips": [
    "Halve the avocados, remove the stones and scoop the flesh into a bowl, choosing fruit that gives slightly when pressed as underripe avocado will not mash smoothly.",
    "Cut the lime in half and squeeze the juice straight over the avocado, which both sharpens the flavour and stops it browning.",
    "Mash with a fork to the texture you like, leaving it a little chunky rather than completely smooth.",
    "Chop the coriander finely, stems and all, and stir it through with a good pinch of salt, then taste and add more lime or salt as needed.",
    "Tip the tortilla chips into a bowl and serve alongside the guacamole for dipping, ideally straight away while the guacamole is at its greenest."
  ],
  "halloumi-pitta": [
    "Slice the halloumi into slabs about a centimetre thick and pat them dry, so they colour rather than steam.",
    "Heat a griddle or frying pan over a medium-high heat with no oil, as the halloumi has plenty of its own. Griddle the slices for about 2 minutes a side, until golden and striped.",
    "Stir the rose harissa through the Greek yoghurt in a small bowl, then taste and add a little more if you like more heat.",
    "Slice the cucumber thinly.",
    "Warm the pittas briefly, in a toaster or under the grill, then split each one open to make a pocket.",
    "Fill each pitta with the halloumi, a handful of rocket and some cucumber, then spoon in the harissa yoghurt and serve while the cheese is still warm."
  ],
  "halloumi-traybake": [
    "Heat the oven to 200C/180C fan and drain and rinse the chickpeas, patting them dry so they roast rather than steam.",
    "Deseed and slice the red peppers, cut the onion into wedges, and tip everything into a large roasting tin.",
    "Spoon over the harissa and toss well so the chickpeas and vegetables are evenly coated, then spread them into a single layer.",
    "Roast for 25 minutes, until the peppers are softening and the chickpeas are starting to crisp.",
    "Cut the halloumi into cubes, scatter over the tray, and roast for a further 12 minutes until the cheese is golden and squeaky.",
    "Squeeze over the lemon, scatter with chopped parsley and serve."
  ],
  "ham-cheese-lunchbox": [
    "Cut the cheddar into bite-sized cubes so they are easy to pick up.",
    "Roll or fold the slices of ham into loose bundles.",
    "Cut the cucumber into sticks of a similar length so they pack neatly.",
    "Pull the grapes from their stalks and rinse them, halving any large ones for younger children.",
    "Divide the crackers, cheese, ham, grapes and cucumber between four boxes, keeping the crackers to one side so they stay crisp until eaten."
  ],
  "huevos-rancheros": [
    "Drain the black beans and tip them into a small pan with half the salsa, then warm through over a medium heat until steaming, mashing a few beans to thicken.",
    "Warm the tortillas one at a time in a dry frying pan for a few seconds each side, then keep them wrapped in a clean tea towel so they stay soft.",
    "Heat a little oil in the pan and crack in the eggs, frying until the whites are fully set and the edges are lacy and crisp while the yolks stay soft.",
    "Halve, stone and slice the avocados, and roughly chop the coriander.",
    "Sit a warm tortilla on each plate, spoon over the beans, slide an egg on top, then add the remaining salsa, avocado and coriander.",
    "Season with a little salt and black pepper and serve straight away while the eggs are hot."
  ],
  "hummus-bowl": [
    "Heat the oven to 200C/180C fan and cut the courgettes and deseeded red peppers into rough, bite-sized chunks.",
    "Spread the vegetables on a baking tray, toss with a little oil, salt and pepper, and roast for 25 minutes until soft and lightly charred at the edges.",
    "Meanwhile, drain and rinse the chickpeas, then blend half of them with the tahini, a good squeeze of lemon juice, a pinch of salt and enough cold water to make a smooth, spoonable hummus.",
    "Warm the pittas under the grill or in the oven for the last few minutes of roasting.",
    "Spread the hummus over the base of bowls or plates, then pile on the roasted veg and the remaining whole chickpeas.",
    "Scatter over the pumpkin seeds and serve with the warm pitta and any remaining lemon in wedges."
  ],
  "hummus-veg-sticks": [
    "Drain and rinse the chickpeas, and for the smoothest result slip off any loose skins, which is worth a minute for a silkier dip.",
    "Peel the garlic and add it to a food processor with the chickpeas, tahini and the juice of the lemon.",
    "Blend to a paste, then trickle in a little cold water with the motor running until the hummus turns pale and smooth, stopping to scrape down the sides as needed.",
    "Season with salt, taste, and adjust with more lemon or water until it is as sharp and soft as you like.",
    "Peel the carrots and cut them along with the cucumber into sticks of a similar length, so they sit tidily around the bowl.",
    "Spoon the hummus into a bowl and arrange the vegetable sticks alongside for dipping."
  ],
  "jacket-potato-beans": [
    "Heat the oven to 200C/180C fan. Prick the potatoes all over with a fork so the steam can escape, then rub with a little oil and salt.",
    "Sit them straight on the oven shelf and bake for about 70 minutes until the skins crackle and a knife slides easily into the middle.",
    "Towards the end, tip the black beans with their liquid into a small pan with the chopped tomatoes and smoked paprika.",
    "Warm over a medium heat for a few minutes, stirring, until saucy and thick, then season with salt and pepper.",
    "Grate the cheddar and split each potato down the middle, squeezing the ends to open it up.",
    "Spoon in the beans and top with the grated cheddar so it softens against the hot potato."
  ],
  "kedgeree": [
    "Lay the haddock in a wide pan, pour over enough milk to nearly cover it, and poach gently for about 8 minutes until it flakes at a nudge.",
    "Lift the fish out, then flake it into large pieces, discarding the skin and any bones; keep the poaching milk to one side.",
    "Meanwhile, boil the eggs for 8 minutes, cool them under cold water, peel and quarter; peel and finely chop the onion.",
    "Soften the onion in a little oil for a few minutes, stir in the garam masala and turmeric for a minute until fragrant, then add the rice and coat it in the spices.",
    "Pour in enough stock or the reserved milk to cover the rice by a finger's width, cover, and simmer gently for about 12 minutes until the rice is tender and the liquid absorbed.",
    "Add the peas for the last couple of minutes, then fold through the flaked fish and quartered eggs and warm through gently so the fish stays in pieces.",
    "Chop the parsley, scatter it over and serve."
  ],
  "kimchi-fried-rice": [
    "If you haven't already, cook the basmati rice, then spread it out to cool completely; cold rice fries best and won't turn sticky.",
    "Roughly chop the kimchi and trim and slice the spring onions, keeping them separate.",
    "Heat a little oil in a large frying pan or wok over a high heat and fry the kimchi hard for 3 minutes until it smells rich and starts to caramelise.",
    "Add the cold rice and the soy sauce and fry, pressing it into the pan and turning it every so often, until it is piping hot and catching in crisp patches in places.",
    "Push the rice to one side, add a drop more oil and fry the eggs for 2 to 3 minutes until the whites are set but the yolks still soft.",
    "Drizzle the sesame oil over the rice, divide between bowls and top each with an egg and the sliced spring onions."
  ],
  "lamb-koftas": [
    "If using wooden skewers, soak them in water first so they do not scorch under the grill.",
    "Coarsely grate the onion and squeeze out some of the liquid, then mix it into the lamb mince with the cumin, salt and pepper until well combined.",
    "Divide the mixture into equal pieces and press each firmly around a skewer into a sausage shape, so they hold together while cooking.",
    "Heat the grill to high and grill the koftas for about 10 minutes, turning them now and then, until browned and charred at the edges and cooked through.",
    "Meanwhile, warm the pittas, dice or slice the cucumber, and finely chop the mint before stirring most of it through the yoghurt.",
    "Serve the koftas tucked into the warm pittas with the minted yoghurt, cucumber and a scattering of the remaining mint."
  ],
  "lentil-feta-salad-box": [
    "Put the Dijon mustard in a small bowl with a pinch of salt and pepper, then whisk in the vinegar first so the salt dissolves.",
    "Slowly whisk in the oil a little at a time until the dressing looks thick and glossy rather than split, which stops it tasting sharp.",
    "If the cooked lentils are in liquid, drain them well and shake off any excess so the dressing coats them instead of pooling in the box.",
    "Dice the cooked beetroot into small cubes, adding it just before serving or keeping it slightly apart, as it will bleed pink into everything if left to sit.",
    "Toss the lentils with most of the dressing, then fold through the beetroot gently so the colour stays streaky rather than turning the whole lot purple.",
    "Pile the rocket on top, crumble over the feta, scatter the pumpkin seeds and trickle over the last of the dressing."
  ],
  "lentil-shepherds-pie": [
    "Peel the potatoes, cut them into even chunks and boil in salted water for 15 to 20 minutes until a knife slides in easily, then drain and mash smooth with a little salt and pepper.",
    "While the potatoes cook, peel and chop the onion and carrot, then soften them in a little oil over a medium heat for about 10 minutes until tender.",
    "Add the cooked green lentils, chopped tomatoes and the stock cube crumbled into a splash of water, then simmer for 15 minutes until thick and saucy.",
    "Heat the oven to 190C/170C fan and season the lentil mixture to taste before spooning it into a baking dish.",
    "Spread the mash evenly over the top, rough up the surface with a fork so it crisps, and scatter over the grated cheddar.",
    "Bake for 35 minutes until the top is golden and the filling bubbles at the edges, then let it stand for a few minutes before serving."
  ],
  "lentil-soup": [
    "Finely chop the onion and carrot. Warm the olive oil in a large pan over a medium heat.",
    "Soften the onion and carrot for about 8 minutes, stirring now and then, until the onion is soft and translucent, then stir in the ground cumin and cook for a minute until fragrant.",
    "Rinse the red lentils in a sieve until the water runs clear, then add them to the pan.",
    "Crumble in the two stock cubes and pour in 1.5 litres of just-boiled water. Bring to a simmer and cook for 25 minutes, until the lentils are soft and collapsing.",
    "Blend until smooth with a stick blender, loosening with a little water if it is thicker than you like.",
    "Squeeze in lemon juice to sharpen, then taste and season with salt and pepper until the flavour lifts."
  ],
  "mackerel-beetroot-salad": [
    "Cut the top and bottom off each orange, stand it on a board, and slice away the peel and white pith following the curve of the fruit.",
    "Working over a bowl to catch the juice, cut between the membranes to release the segments.",
    "Whisk the Dijon mustard into the caught orange juice, then whisk in a little oil to make a light dressing with salt and pepper.",
    "Slice the cooked beetroot into wedges and arrange it with the rocket and orange segments on a platter.",
    "Peel the skin off the smoked mackerel and flake the fillets into large pieces over the top.",
    "Spoon over the dressing and scatter with the pumpkin seeds to serve."
  ],
  "mackerel-pate-toast": [
    "Peel the skin away from the smoked mackerel fillets and flake the flesh into a bowl, checking with your fingers for any small bones as you go.",
    "Add the cream cheese and beat it into the fish with a fork until you have a rough, spreadable pâté, leaving a little texture rather than making it completely smooth.",
    "Cut the lemon in half, squeeze in the juice a little at a time and taste as you go, then season with plenty of black pepper, which balances the richness.",
    "Toast the seeded wholemeal bread until golden and firm, so it holds up under the pâté without going floppy.",
    "Cut the cucumber into finger-length batons to serve alongside for something cool and crunch.",
    "Spread the pâté generously over the warm toast and serve with the cucumber batons and any remaining lemon cut into wedges."
  ],
  "mackerel-potato-salad": [
    "Cut any larger potatoes so they are all a similar size, then boil in salted water for 15 to 18 minutes, until a knife slides in easily.",
    "Drain the potatoes and, while still warm, halve them so they soak up the dressing better.",
    "In a large bowl, whisk the creme fraiche with the Dijon mustard and a good squeeze of lemon juice, plus salt and pepper, into a loose dressing.",
    "Peel the skin from the mackerel fillets and flake the flesh into chunks, checking for any stray bones as you go.",
    "Add the warm potatoes to the dressing and fold gently to coat, then fold through the flaked mackerel so it stays in pieces.",
    "Roughly chop the parsley, then fold it through with the rocket just before serving so the leaves stay fresh."
  ],
  "masala-omelette": [
    "Finely chop the onion, tomatoes, red chilli and coriander so they cook through quickly and spread evenly.",
    "Crack the eggs into a bowl, add the turmeric and a good pinch of salt, and beat well until the yolks and whites are fully combined.",
    "Stir the chopped onion, tomato, chilli and coriander into the eggs.",
    "Heat a little oil in a frying pan over a medium heat and pour in half the mixture, tilting the pan so it spreads evenly.",
    "Cook for a couple of minutes until the underside is set and golden, then fold in half and slide onto a plate.",
    "Wipe the pan, add a little more oil and repeat with the rest of the mixture to make the second omelette."
  ],
  "minestrone": [
    "Finely dice the onion, carrot and courgette so they cook evenly. Warm a little oil in a large pan over a medium heat.",
    "Add the vegetables with a pinch of salt and soften for about 10 minutes, stirring now and then, until the onion looks glassy but not browned.",
    "Tip in the chopped tomatoes and the drained borlotti beans, then crumble in the two stock cubes and pour in 1.5 litres of just-boiled water.",
    "Bring up to a gentle simmer and cook for 20 minutes, so the flavours come together and the soup thickens slightly.",
    "Stir in the penne and cook for a final 10 minutes, until the pasta is tender but still has a little bite. Stir occasionally so it does not stick to the base.",
    "Taste and season with salt and pepper. Ladle into bowls and grate over the parmesan just before serving."
  ],
  "miso-salmon": [
    "Heat the oven to 200C/180C fan and line a small tin. Grate the ginger and mix it with the white miso paste and honey to a smooth glaze.",
    "Sit the salmon fillets on the tin and smear the miso glaze thickly over the tops and sides.",
    "Roast for about 12 minutes until the glaze is sticky and the salmon flakes easily when pressed but is still just moist in the middle.",
    "Meanwhile, cook the basmati rice to your usual method and halve the pak choi lengthways.",
    "Steam the pak choi for a few minutes until the stems are just tender and the leaves have wilted.",
    "Dress the pak choi with the toasted sesame oil and serve alongside the salmon and rice."
  ],
  "mushroom-risotto": [
    "Crumble the stock cubes into 1.2 litres of boiling water and keep it hot on a low heat; slice the mushrooms and finely chop the onion.",
    "Fry the mushrooms hard in a little of the butter over a high heat until browned, then tip them out and set aside.",
    "In the same pan, soften the onion gently in a little more butter for a few minutes until translucent but not coloured.",
    "Stir in the arborio rice and toast for a minute, then begin adding the hot stock a ladle at a time, stirring often and letting each addition be absorbed before the next.",
    "Carry on for about 20 minutes until the rice is creamy and just tender with a slight bite, adding the peas for the final few minutes.",
    "Stir the mushrooms back in with the remaining butter and the grated parmesan, then take off the heat and rest, covered, for 2 minutes before serving."
  ],
  "mushroom-toast": [
    "Wipe the mushrooms clean and slice them thickly, and peel and finely chop or crush the garlic.",
    "Melt the butter in a large frying pan over a medium-high heat until it foams.",
    "Add the mushrooms and fry hard for about 8 minutes without stirring too often, so they brown properly rather than stew in their own liquid.",
    "Put the bread on to toast while the mushrooms cook.",
    "Stir the garlic through for the last minute, just until fragrant, then season well with salt and pepper.",
    "Roughly chop the parsley, toss most of it through the pan, then pile the mushrooms onto the toast and scatter with the rest."
  ],
  "nachos-lunch": [
    "Heat the oven to 200C/180C fan and line a baking tray with foil or greaseproof paper, which makes lifting the nachos off much easier.",
    "Drain and rinse the black beans, then spread the tortilla chips over the tray in a single layer so every chip has a chance to crisp rather than steam.",
    "Scatter the beans evenly over the chips, then grate the cheddar and sprinkle it right to the edges so nothing is left bare.",
    "Bake for about 10 minutes, until the cheese has fully melted and is just starting to bubble at the edges but the chips have not caught or darkened.",
    "Take the tray out and let it settle for a minute so the cheese firms slightly and you can lift portions without them falling apart.",
    "Spoon over the tomato salsa and guacamole in loose dollops rather than covering everything, so the chips underneath stay crisp.",
    "Tear the coriander leaves over the top and serve straight away while warm."
  ],
  "oat-pancakes-berries": [
    "Put the oats, eggs, yoghurt and milk in a blender and blitz to a smooth batter, then leave it to rest for 5 minutes so the oats swell and thicken it.",
    "Melt a knob of the butter in a frying pan over a medium heat, swirling to coat the base.",
    "Spoon in rounds of batter, spacing them apart, and cook for about 2 minutes until bubbles appear on top and the edges look set.",
    "Flip each pancake and cook for another minute or so until golden underneath and cooked through, then keep warm while you fry the rest, adding butter as needed.",
    "Tip the frozen berries into a small pan and warm over a medium heat for a few minutes until they collapse into a loose sauce.",
    "Stack the pancakes and spoon the warm berries over the top."
  ],
  "oatcakes-nut-butter": [
    "Lay the oatcakes out on a board or plates.",
    "Spread each one generously with almond butter, right to the edges.",
    "Peel the bananas and slice them into thin rounds.",
    "Arrange the banana slices over the almond butter and serve straightaway, while the oatcakes are still crisp."
  ],
  "orzo-tomato-feta": [
    "Heat the oven to 200C/180C fan and dissolve the stock cube in 700ml of boiling water.",
    "Cut the courgette into small chunks, then tip it into a roasting tin with the orzo, cherry tomatoes and dried oregano.",
    "Pour over the stock and stir so the orzo settles into an even layer, as this stops it clumping as it bakes.",
    "Sit the block of feta in the middle, drizzle it with a little oil, and bake for 30 minutes until the orzo is tender and most of the liquid is absorbed.",
    "If it looks dry before the orzo softens, stir in a splash of hot water and return it to the oven.",
    "Stir the melted feta through so it turns the sauce creamy, season with pepper, and scatter with torn basil to serve."
  ],
  "pasta-pesto-lunchbox": [
    "Bring a large pan of salted water to the boil and cook the penne to just tender, adding the peas for the final two minutes.",
    "Drain in a colander and rinse under cold running water until the pasta and peas are completely cool, then shake dry.",
    "Put the basil, parmesan and olive oil in a blender with a pinch of salt and blitz to a loose pesto, loosening with a splash of water if needed.",
    "Halve the cherry tomatoes.",
    "Tip the cold pasta and peas into a bowl, spoon over the pesto and toss until every piece is coated.",
    "Fold through the halved tomatoes and season with black pepper before packing into boxes."
  ],
  "pasta-pesto-peas": [
    "Bring a large pan of well-salted water to the boil for the penne and cook it to the packet time until just tender.",
    "For the pesto, put half the peas in a blender with the basil, most of the parmesan, the peeled garlic, a squeeze of lemon and the olive oil.",
    "Blitz to a loose, spoonable pesto, adding a splash of water if needed, then season with salt and pepper.",
    "Add the remaining peas to the pasta pan for the last 2 minutes of cooking so they warm through.",
    "Drain the pasta and peas, saving a mugful of the cooking water, then return them to the pan off the heat.",
    "Stir through the pesto with enough pasta water to make it cling, then finish with the rest of the parmesan and a little more lemon to taste."
  ],
  "penne-arrabbiata": [
    "Bring a large pan of well-salted water to the boil for the penne and cook it to the time on the packet until just tender with a little bite.",
    "Meanwhile, thinly slice the garlic and warm it gently with the chilli flakes in the olive oil over a low heat.",
    "Keep the heat gentle so the garlic softens and turns pale gold without browning, which would make it bitter.",
    "Pour in the passata, season with salt, and simmer for 15 minutes until it darkens slightly and turns glossy, stirring occasionally.",
    "Drain the penne, saving a mugful of the cooking water, then toss the pasta through the sauce with a splash of that water to help it cling.",
    "Tear in most of the basil, grate over the parmesan, and serve with the rest of the basil on top."
  ],
  "pitta-hummus-strips": [
    "Drain and rinse the chickpeas, saving a little of the liquid, and for a smoother hummus rub off any loose skins between your fingers.",
    "Put the chickpeas in a food processor with the tahini and the juice of the lemon, then blend to a thick paste.",
    "With the motor running, add a splash of water a little at a time until the hummus loosens to a soft, spoonable texture, then season with salt to taste.",
    "Spoon into a bowl, make a shallow well in the top with the back of the spoon and dust over the smoked paprika.",
    "Toast the wholemeal pittas under the grill or in a toaster until warm and lightly puffed.",
    "Cut the warm pittas into strips with scissors or a knife and serve alongside the hummus for dipping."
  ],
  "ploughmans-lunch": [
    "Cut the cheddar into thick wedges rather than thin slices, so it holds its own on the plate.",
    "Core the apples and slice them into rounds or wedges; leave the skin on for colour and crunch.",
    "Cut the cucumber into chunky batons or thick rounds.",
    "Slice the seeded loaf thickly, ready for people to build their own mouthfuls.",
    "Arrange the cheese, apple, cucumber and bread in loose groups on a board so everything is easy to reach.",
    "Spoon the Dijon mustard into a small dish and set it alongside, so people can add as little or as much as they like."
  ],
  "popcorn-paprika": [
    "Pour the oil into a large heavy pan with a tight lid, add two or three kernels and set over a medium-high heat.",
    "When those test kernels pop, tip in the rest in a single layer and put the lid straight back on.",
    "Shake the pan often, keeping it just off the heat now and then, so the kernels cook evenly without the oil catching.",
    "When the popping slows to a gap of a couple of seconds between pops, take the pan off the heat so nothing burns.",
    "Tip the hot popcorn into a bowl, scatter over the smoked paprika and a pinch of salt, and toss well so it clings while the popcorn is still warm."
  ],
  "pork-noodle-stirfry": [
    "Boil the egg noodles according to the packet, then drain and toss with a drop of the sesame oil so they do not stick while you cook the rest.",
    "Peel and finely grate or shred the ginger, cut the broccoli into small florets and slice the spring onions.",
    "Heat a little oil in a wok or large frying pan until very hot, add the pork mince and fry hard, breaking it up, until crisp and browned at the edges.",
    "Add the ginger and broccoli and stir-fry for about 4 minutes, until the broccoli is bright green and just tender with a little bite.",
    "Tip in the drained noodles, the soy sauce and the rest of the sesame oil, and toss everything together over the heat until hot and well coated.",
    "Scatter the spring onions over the top and serve straight from the pan."
  ],
  "porridge-berries": [
    "Tip the oats and milk into a medium pan and add a small pinch of salt, which brings out the flavour rather than making it salty.",
    "Set the pan over a medium heat and stir now and then as it comes up to a gentle simmer, so the oats do not catch on the bottom.",
    "Once it starts to bubble, turn the heat down and stir more often for about 5 minutes, until the porridge is thick and creamy and coats the back of the spoon.",
    "If it thickens too far before the time is up, loosen it with a splash more milk or a little water until it drops easily from the spoon.",
    "Take the pan off the hob and divide the porridge between four bowls.",
    "Scatter the berries over the top and finish each bowl with a drizzle of honey."
  ],
  "puttanesca": [
    "Bring a large pan of salted water to the boil for the spaghetti and cook it to the packet time until just tender.",
    "Meanwhile, finely chop the garlic and roughly chop the olives, and warm the olive oil in a wide pan over a low heat.",
    "Add the anchovy fillets, garlic and chilli flakes and stir for a minute or two until the anchovies melt into the oil and disappear.",
    "Tip in the chopped tomatoes, olives and capers, then simmer for 15 minutes until thickened and glossy; go easy on salt as the anchovies, olives and capers are already salty.",
    "Drain the spaghetti, saving a mugful of the cooking water, then toss the pasta through the sauce.",
    "Loosen with a splash of the pasta water so the sauce coats every strand, and serve straight away."
  ],
  "quorn-chilli": [
    "Finely chop the onion and deseed and dice the red pepper, then soften them in a little oil in a large pan over a medium heat for about 8 minutes until soft and sweet.",
    "Stir in the ground cumin and smoked paprika and cook for 1 minute so the spices toast and become fragrant.",
    "Drain and rinse the black beans, then add the Quorn mince and chopped tomatoes to the pan and stir everything together.",
    "Bring to a gentle simmer and cook for 30 minutes, stirring now and then, until thick and rich; add a splash of water if it tightens too much.",
    "Stir in the drained beans towards the end just to heat through so they keep their shape.",
    "Season generously with salt and pepper, and serve with the basmati rice cooked to your usual method."
  ],
  "quorn-stir-fry": [
    "Cook the egg noodles to the packet instructions, then drain and toss with a drop of oil so they do not stick while you cook the rest.",
    "Cut the pepper into strips, break the broccoli into small florets, and finely chop the peeled ginger and garlic.",
    "Get a wok or large frying pan very hot with a little oil, then fry the Quorn pieces hard for about 5 minutes until browned at the edges, moving them only occasionally.",
    "Add the ginger and garlic for a few seconds, then the broccoli and pepper, and stir-fry for 4 minutes so the veg stays bright and crisp.",
    "A splash of water added with the broccoli helps it cook through in the steam without losing its crunch.",
    "Tip in the noodles, edamame and soy sauce, and toss over the heat for a minute until everything is hot and coated."
  ],
  "rice-cakes-cheese": [
    "Slice the cheddar thinly so it sits flat and does not overhang the edges of the rice cakes.",
    "Cut the cucumber into thin rounds, or into batons if you prefer a bit more crunch.",
    "Lay the rice cakes out on a board and top each with a slice or two of cheese.",
    "Add a few pieces of cucumber on top, pressing down gently so they hold.",
    "Season with a little black pepper and serve straight away, before the rice cakes soften."
  ],
  "roast-chicken": [
    "Heat the oven to 190C/170C fan and sit the chicken in a roasting tin; halve the lemon, squeeze a little over the bird and push both halves into the cavity.",
    "Rub the chicken with a little of the olive oil, season all over, and roast for 1 hour 20 minutes, until the juices run clear when you pierce the thickest part of the thigh.",
    "Meanwhile, peel and chop the potatoes and carrots, cut the onions into wedges, and parboil the potatoes and carrots in salted water for 8 minutes, then drain well.",
    "About 50 minutes before the chicken is done, toss the drained vegetables and onions in the rest of the oil, season, and roast in a separate tin, turning once, until golden and crisp.",
    "Lift the cooked chicken onto a board, cover loosely with foil and rest for 15 minutes so the juices settle and it carves cleanly.",
    "While it rests, steam the broccoli for a few minutes until just tender and make gravy from the resting juices, then carve and serve."
  ],
  "roasted-veg-couscous": [
    "Heat the oven to 200C/180C fan. Cut the courgettes and deseeded peppers into chunks and the peeled red onion into wedges.",
    "Drain and rinse the chickpeas, then tip them onto a large tin with the vegetables, spoon over the rose harissa, and toss so everything is coated.",
    "Spread it out in a single layer and roast for 30 minutes, turning once, until the vegetables are tender and lightly charred at the edges.",
    "Meanwhile, put the couscous in a bowl, pour over 300ml of boiling stock, cover with a plate, and leave for 10 minutes.",
    "Fluff the couscous with a fork to separate the grains, then fold the roasted vegetables and chickpeas through it.",
    "Loosen the tahini with a squeeze of lemon and a little water until it pours from a spoon, then drizzle it over and scatter with chopped parsley."
  ],
  "salmon-traybake": [
    "Heat the oven to 200C/180C fan. Halve the potatoes, toss them with some of the olive oil, salt and pepper, and spread out in a single layer in a roasting tin.",
    "Roast the potatoes for 20 minutes, until they are starting to soften and colour at the edges.",
    "Meanwhile, cut the courgettes into thick half-moons and leave the cherry tomatoes whole.",
    "Add the courgettes and tomatoes to the tin with the rest of the oil and the oregano, toss to coat, and roast for a further 10 minutes.",
    "Make space and sit the salmon fillets on top of the vegetables, season them, and squeeze over the juice of the lemon.",
    "Roast for a final 12 minutes, until the salmon is just opaque and flakes easily when pressed. Serve straight from the tin."
  ],
  "sardine-pasta": [
    "Bring a large pan of well-salted water to the boil and cook the spaghetti until just tender with a little bite, following the packet time.",
    "While it cooks, peel and thinly slice the garlic, and finely grate the zest from the lemon before squeezing its juice.",
    "Warm the olive oil in a wide pan over a medium heat and gently sizzle the garlic and chilli flakes for a minute, until fragrant but not browned, as burnt garlic turns bitter.",
    "Tip in the sardines with their oil and break them up with a spoon, warming them through into a rough sauce.",
    "Just before draining, scoop out a mugful of the starchy pasta water, then add the spaghetti to the pan with the lemon zest, juice and a good splash of the water.",
    "Toss everything together over the heat until the sauce clings and looks glossy, loosening with more pasta water if it looks dry.",
    "Roughly chop the parsley, stir most through and scatter the rest on top to serve."
  ],
  "satay-noodles": [
    "Put the rice noodles in a heatproof bowl, cover with boiling water and leave to soak for 5 minutes until soft but still with a little bite, then drain.",
    "While they soak, coarsely grate the carrots and cut the lime in half.",
    "Warm the peanut butter, coconut milk and soy sauce together in a small pan over a low heat, stirring, until smooth and glossy; loosen with a splash of water if it looks thick.",
    "Add the edamame beans to the sauce and warm through for a minute or two.",
    "Tip in the drained noodles and grated carrot and toss well so the sauce coats everything evenly.",
    "Squeeze in the juice of the lime to sharpen it, taste and add a little more soy if needed, then serve."
  ],
  "satsumas-seeds": [
    "Put a dry frying pan over a medium heat and give it a moment to warm through before the seeds go in.",
    "Add the sunflower seeds and the ground cinnamon, then toast for about 3 minutes, shaking the pan often so they colour evenly and do not catch.",
    "Listen for a gentle popping and watch for the seeds turning a shade darker and smelling nutty, which is the sign they are done.",
    "Tip them straight out of the hot pan onto a plate to cool, as they will keep cooking if left in the pan.",
    "Peel the satsumas and pull them into segments while the seeds cool.",
    "Serve the satsuma segments alongside the warm cinnamon seeds for scattering or eating by the spoonful."
  ],
  "sausage-traybake": [
    "Heat the oven to 200C/180C fan. Cut the potatoes into chunks, peel and cut the red onions into wedges, and deseed and slice the red peppers into thick strips.",
    "Tip the potatoes, onions and peppers into a large roasting tin, add the sausages, and scatter over the dried oregano with salt and pepper.",
    "Pour over the olive oil and toss everything with your hands so it is all lightly coated, then spread it into a single layer with a little space around each piece.",
    "Roast for 40 minutes, turning everything once halfway through so it colours evenly and the potatoes crisp underneath.",
    "It is ready when the sausages are burnished and cooked through with no pink in the middle and the potatoes are tender to a knife.",
    "Give it a final toss in the tin to pick up the pan juices before serving."
  ],
  "scrambled-eggs-toast": [
    "Crack the eggs into a bowl, add the milk and a little salt and pepper, and beat well with a fork until the yolks and whites are fully combined.",
    "Put the bread on to toast now so it is ready at the same time as the eggs.",
    "Melt the butter in a non-stick pan over a low heat, letting it foam gently without browning.",
    "Pour in the eggs and leave for a few seconds, then stir slowly and steadily, pulling the setting egg in from the edges.",
    "Keep the heat low and the eggs moving; take the pan off just before they look done, as they carry on cooking in their own heat.",
    "Butter the toast if you like, pile the soft eggs on top and serve straight away while still glossy."
  ],
  "sea-bass-greens": [
    "Cut the potatoes into even chunks, then boil them in salted water until nearly tender, about 12 minutes.",
    "Trim the green beans and add them to the potato pan for the last 4 minutes, then drain everything and keep warm.",
    "Pat the sea bass fillets dry and season them, especially the skin, which helps it crisp.",
    "Heat a little butter in a frying pan and lay the fillets in skin-side down, pressing gently for a moment so they stay flat, and fry for 4 minutes until the skin is crisp.",
    "Flip the fillets and cook for 1 minute more until just opaque through, then lift onto warm plates.",
    "Add the rest of the butter to the pan with the spinach and a good squeeze of lemon, wilt it briefly, and spoon over the fish and greens."
  ],
  "shakshuka": [
    "Finely slice the onion and deseed and slice the red peppers, then soften them in a little oil in a wide frying pan over a medium heat for about 10 minutes until sweet and floppy.",
    "Stir in the ground cumin and smoked paprika and cook for a minute so the spices become fragrant.",
    "Drain and rinse the chickpeas, then add them with the chopped tomatoes and a good pinch of salt.",
    "Simmer for 10 minutes, stirring now and then, until the sauce thickens enough to hold a trail when you drag a spoon through it.",
    "Make six wells in the sauce with the back of a spoon and crack an egg into each, then cover the pan with a lid.",
    "Cook for about 6 minutes until the whites are just set but the yolks are still soft, and serve with the seeded bread for dipping."
  ],
  "smash-burgers": [
    "Heat the oven to 220C/200C fan. Cut the potatoes into wedges, toss with a little oil, salt and pepper, and spread out on a tin.",
    "Roast the wedges for 35 minutes, turning once, until crisp outside and fluffy within.",
    "Shred the little gem, slice the tomatoes, and split the buns; toast the cut sides in a dry pan or under the grill until lightly golden.",
    "Get a heavy frying pan or flat griddle screaming hot, then press each burger down firmly with a spatula so it forms a thin patty with plenty of surface to crisp.",
    "Fry for 2 minutes until a deep brown crust forms, flip, lay the cheddar on top, and cook 2 minutes more until the cheese softens.",
    "Spread a little Dijon mustard on the bun bases, then build with lettuce, tomato and the cheesy patty, and serve with the wedges."
  ],
  "smoked-salmon-gnocchi": [
    "Bring a large pan of salted water to the boil and drop in the gnocchi.",
    "Cook until they bob up to the surface, which takes only a couple of minutes, adding the peas for the final minute.",
    "Drain the gnocchi and peas, then return them to the warm pan off the heat.",
    "Stir in the creme fraiche and a good squeeze of lemon, letting the residual heat make a light sauce.",
    "Flake in the hot-smoked salmon in generous pieces and add the spinach.",
    "Fold gently until the spinach wilts and everything is coated, then season with pepper and a little more lemon to taste."
  ],
  "smoothie-bowl": [
    "Peel the bananas and break them into chunks. If your berries are frozen, that is fine and will make the bowl thicker and colder.",
    "Set aside a small handful of the berries for the top, then put the rest into a blender with the bananas and Greek yoghurt.",
    "Add the honey and blitz until thick and smooth, stopping to scrape down the sides if needed. Aim for a texture you can eat with a spoon rather than drink.",
    "If it is too stiff to blend, add a splash of water; if it is too loose, add a little more banana or a few more oats.",
    "Spoon into bowls and smooth the tops.",
    "Scatter over the porridge oats and the reserved berries, and serve straight away before it warms up."
  ],
  "soft-cheese-veg-wrap": [
    "Grate the carrots coarsely, deseed the red pepper and slice it into thin strips, and wash the spinach, patting it dry so the wraps do not go damp.",
    "Lay each tortilla wrap flat and spread the garlic and herb soft cheese right to the edges, which acts as the glue that holds the roll together.",
    "Scatter the grated carrot and pepper strips across the middle third of each wrap, leaving a clear border so the filling does not spill as you roll.",
    "Lay the spinach leaves over the top, keeping the pile fairly flat so the wrap rolls up neatly rather than bulging in one spot.",
    "Fold in the two sides, then roll up firmly from the edge nearest you, pressing gently as you go to keep it tight.",
    "Cut each wrap in half on the diagonal, or leave whole and wrap in paper for a lunchbox."
  ],
  "soup-tomato-lentil": [
    "Finely chop the onion and carrot. Warm a little oil in a large pan over a medium heat.",
    "Soften the onion and carrot for about 8 minutes until the onion is soft and translucent, then stir in the smoked paprika and cook for a minute so it smells fragrant.",
    "Rinse the red lentils in a sieve until the water runs clear, then add them to the pan with the chopped tomatoes.",
    "Crumble in the two stock cubes and pour in 1 litre of just-boiled water. Bring to a simmer and cook for 25 minutes, until the lentils are soft and collapsing.",
    "Blend until smooth, either with a stick blender in the pan or carefully in a jug blender. Loosen with a splash of water if it is thicker than you like.",
    "Season hard with salt and plenty of pepper, tasting as you go, until the flavour lifts. Warm through again before serving."
  ],
  "spag-bol": [
    "Finely chop the onion, carrot and garlic. Warm a little oil in a large pan over a medium heat.",
    "Soften the onion, carrot and garlic for about 10 minutes, stirring now and then, until soft and sweet but not browned.",
    "Turn up the heat, add the beef mince and brown it hard, breaking it up with a spoon, until it is well coloured rather than grey; this builds the flavour.",
    "Stir in the tomato puree and cook for a minute, then add the chopped tomatoes and half a tin of water. Season with salt and pepper.",
    "Lower to a gentle simmer and cook for 40 minutes, stirring occasionally, until rich and thickened. Taste and adjust the seasoning near the end.",
    "Cook the spaghetti in plenty of salted water until just tender, drain, then serve topped with the sauce and grated parmesan."
  ],
  "squash-lentil-curry": [
    "Peel the squash, scoop out the seeds and cut the flesh into bite-sized cubes; peel and chop the onion.",
    "Soften the onion in a little oil in a large pan over a medium heat for a few minutes until translucent.",
    "Stir in the garam masala and turmeric for a minute until fragrant, then add the squash and lentils and turn them through the spices.",
    "Pour in the coconut milk and 400ml water, bring to a gentle simmer and stir to stop the lentils sticking.",
    "Simmer for about 30 minutes, stirring now and then, until the lentils are soft and the squash is tender and starting to break down; add a splash of water if it gets too thick.",
    "Stir in the spinach a handful at a time until wilted, and serve with rice cooked separately in boiling salted water."
  ],
  "steak-chips-salad": [
    "Heat the oven to 220C/200C fan. Scrub the potatoes and cut them into chips about a centimetre thick, keeping the skins on for texture.",
    "Toss the chips with most of the olive oil, salt and pepper on a large tin, spreading them out so they are not touching, then roast for 35 minutes, turning halfway, until golden and crisp at the edges.",
    "Take the steaks out of the fridge 20 minutes before cooking so they lose their chill, then pat them dry and season both sides with salt and pepper.",
    "Get a heavy frying pan very hot with a little oil, then fry the steaks for 3 minutes a side for medium-rare; press one gently and it should feel soft with a little spring.",
    "Lift the steaks onto a warm plate and rest them for 5 minutes, loosely covered, so the juices settle back into the meat rather than running out.",
    "Whisk the Dijon mustard with the remaining olive oil, a splash of water and a pinch of salt, toss through the rocket, and shave over the parmesan with a peeler to serve alongside the steak and chips."
  ],
  "stuffed-dates": [
    "Run a small knife down one side of each date and open it out, then lift out the stone if it is still in.",
    "Spoon a little almond butter into the hollow, roughly a teaspoon per date, so it sits level with the top rather than spilling over.",
    "Press a single flaked almond into the almond butter so it stands proud and holds in place.",
    "Pinch the sides of the date back together slightly so it keeps its shape and the filling stays put.",
    "Arrange on a plate and serve as they are; they will keep in a tub in the fridge for a couple of days if you make them ahead."
  ],
  "sundried-tomato-orzo": [
    "Roughly chop the sun-dried tomatoes and dissolve the stock cube in 700ml of boiling water.",
    "Tip the orzo into a wide pan and pour over the hot stock, then bring to a simmer.",
    "Cook for about 12 minutes, stirring often so it doesn't stick, until the orzo is tender and has absorbed almost all the stock into a creamy, risotto-like texture.",
    "Stir through the chopped sun-dried tomatoes, then add the spinach a handful at a time and fold it through until wilted.",
    "Crumble over the feta and add a squeeze of lemon juice, then taste and season, remembering the feta and stock are already salty.",
    "Serve straightaway while loose and creamy, with the remaining lemon cut into wedges."
  ],
  "sweet-potato-black-bean-tacos": [
    "Heat the oven to 220C/200C fan and peel and dice the sweet potatoes into small, even cubes so they cook through at the same rate.",
    "Toss the cubes with a little oil, the smoked paprika and some salt, spread them out in a single layer on a tray and roast for about 30 minutes until soft and caramelised at the edges.",
    "Drain and rinse the black beans, then warm them through in a small pan with a squeeze of lime and a pinch of salt.",
    "Halve and stone the avocados and slice or mash the flesh, and cut the remaining lime into wedges.",
    "Warm the tortilla wraps briefly in the oven or a dry pan so they are soft and easy to fold.",
    "Fill the wraps with the roasted sweet potato and beans, top with avocado and a spoonful of yoghurt, and serve with the lime wedges to squeeze over."
  ],
  "thai-green-prawn-curry": [
    "Rinse the basmati rice until the water runs clear, then put it on to cook so it is ready when the curry is.",
    "Heat a little oil in a wide pan over a medium heat, add the Thai green curry paste and fry for 1 minute, stirring, until it smells fragrant.",
    "Pour in the coconut milk, stir to loosen the paste, and simmer gently for 5 minutes to bring the sauce together.",
    "Cut the broccoli into small florets, add them to the sauce and cook for 4 minutes, until just tender but still bright.",
    "Stir in the prawns and cook for about 3 minutes, until they have turned pink all the way through and are no longer grey.",
    "Squeeze in lime juice to sharpen, then serve over the rice with the coriander torn over the top."
  ],
  "tuna-nicoise": [
    "Put the potatoes into a pan of salted water, bring to the boil and cook for about 15 minutes until tender to the point of a knife.",
    "Add the green beans for the final 4 minutes so they turn bright and just tender, then drain and let the potatoes cool enough to halve any large ones.",
    "Boil the eggs separately for 7 minutes, cool them under cold water, then peel and quarter.",
    "In a small bowl or jar, whisk the mustard, olive oil and a squeeze of lemon with salt and pepper until it comes together into a dressing.",
    "Halve the cherry tomatoes, separate the little gem leaves and drain the tuna.",
    "Arrange the lettuce, potatoes, beans, tomatoes, eggs and flaked tuna over a large platter.",
    "Spoon the dressing generously over everything just before serving."
  ],
  "tuna-sweetcorn-jacket": [
    "Heat the oven to 200C/180C fan and prick the potatoes all over with a fork so the steam can escape.",
    "Sit the potatoes straight on the oven shelf and bake for about 70 minutes, until the skins are crisp and a knife slides easily into the middle.",
    "While they bake, drain the tuna and sweetcorn well so the filling is not watery.",
    "Finely slice the spring onion and mix it with the tuna, sweetcorn and crème fraîche, then season with salt and black pepper.",
    "Split each baked potato down the middle and squeeze the ends to open it out.",
    "Pile the tuna mixture into the potatoes and serve while they are still hot."
  ],
  "tuna-sweetcorn-wraps": [
    "Drain the tuna well, pressing it against the tin lid to squeeze out the spring water so the filling is not watery.",
    "Tip the tuna into a bowl with the drained sweetcorn and the creme fraiche, and add plenty of black pepper.",
    "Mix together, breaking up the tuna with a fork until it is spreadable but still has some texture. Taste and add salt if it needs it.",
    "Shred the little gem lettuce finely.",
    "Lay the tortilla wraps out flat and spread the tuna mixture over each one, leaving a clear border around the edge so it does not squeeze out.",
    "Scatter the shredded lettuce down the middle, roll each wrap up tightly, then cut in half on the diagonal to serve."
  ],
  "tuna-white-bean-salad": [
    "Drain and rinse the cannellini beans, and drain the tuna well, then tip both into a large bowl.",
    "Peel the red onion and slice it very thinly so it is mild, then halve the cherry tomatoes.",
    "Roughly chop the parsley, leaves and tender stalks, and add it with the onion and tomatoes to the bowl.",
    "Squeeze over the lemon, add the olive oil and plenty of black pepper with a little salt.",
    "Toss gently with your hands so the beans keep their shape and everything is lightly coated.",
    "Taste and adjust with more lemon or pepper, and leave for a few minutes before serving so the flavours settle."
  ],
  "turkish-breakfast-plate": [
    "Lower the eggs into a pan of gently boiling water and cook for 7 minutes for a just-set yolk.",
    "Drain and cool the eggs under cold running water for a minute, then peel and halve them.",
    "Slice the cucumber and tomatoes into rounds or wedges and cut the feta into slabs or cubes.",
    "Toast or slice the seeded wholemeal loaf so there is bread for everyone.",
    "Arrange the eggs, feta, cucumber, tomatoes and olives in groups on a board with the bread alongside.",
    "Drizzle the honey over the feta or into a little dish for dipping, and season the tomatoes with a pinch of salt."
  ],
  "turkish-eggs-beans": [
    "Peel and finely grate or crush the garlic, keeping half back for the yoghurt.",
    "Put the drained butter beans in a pan with the chopped tomatoes, half the garlic and the smoked paprika, add a splash of water and season.",
    "Simmer gently for 12 minutes, stirring now and then, until the sauce has thickened and the beans are hot through.",
    "Meanwhile, stir the remaining garlic into the Greek yoghurt with a pinch of salt and warm the pittas under the grill or in a low oven.",
    "Roughly chop the parsley, then spoon the beans into bowls and top with the garlicky yoghurt.",
    "Scatter over the parsley and serve with the warm pitta for scooping."
  ],
  "vietnamese-noodle-salad": [
    "Put the rice noodles in a bowl, cover with boiling water and soak for about 5 minutes until tender, then drain and rinse well under cold water so they don't clump, and leave to drain fully.",
    "If the edamame are frozen, cook them briefly in boiling water, then drain and cool.",
    "Whisk the juice of the limes with the fish sauce and honey in a large bowl until the honey dissolves into a balanced dressing, tasting for a sweet-salty-sour balance.",
    "Coarsely grate the carrots, halve the cucumber lengthways and slice it thinly, and tear the mint leaves from their stalks.",
    "Add the drained noodles, carrot, cucumber and edamame to the bowl with the dressing and toss well so everything is coated.",
    "Fold through the mint just before serving so it stays fresh."
  ],
  "yoghurt-frozen-berries": [
    "Tip the frozen berries onto a board and crush them roughly with a fork or the back of a spoon, working quickly while they are still firm.",
    "Spoon the Greek yoghurt into a bowl and drizzle over the honey.",
    "Stir the crushed berries through the yoghurt in a few loose strokes so it ripples pink and purple rather than turning uniformly one colour.",
    "Leave to stand for a couple of minutes if you prefer the berries softened, or serve straight away while they still have a little frozen crunch.",
    "Taste and add a touch more honey if the berries are sharp, then divide between bowls."
  ],
  "yoghurt-fruit-nuts": [
    "Put the nuts into a dry frying pan and set it over a medium heat.",
    "Toast for about 3 minutes, shaking the pan often, until they smell fragrant and turn a shade darker; keep an eye on them as nuts catch quickly.",
    "Tip the toasted nuts onto a board, let them cool for a minute, then chop roughly so you keep some crunch.",
    "Spoon a layer of yoghurt into four glasses or bowls.",
    "Add the berries and a scattering of the chopped nuts, then repeat the layers if you have room.",
    "Finish with a drizzle of honey over the top."
  ],
  "yoghurt-granola-pear": [
    "Core the pears and dice them into small, even pieces so they spoon up easily.",
    "Spoon a layer of Greek yoghurt into the bottom of glasses or bowls.",
    "Scatter over some of the oats, diced pear and sunflower seeds.",
    "Repeat the layers, finishing with a spoonful of yoghurt on top.",
    "Dust with the ground cinnamon and serve; if you like the oats soft, make it a few minutes ahead so they soak a little."
  ],
  "yoghurt-seeds-honey": [
    "Toast the pumpkin seeds in a dry frying pan over a medium heat, shaking often, for 2 to 3 minutes until they smell nutty and start to pop.",
    "Tip them onto a plate to cool so they stay crisp rather than steaming in the pan.",
    "Spoon the coconut yoghurt into bowls or one serving dish and level the top.",
    "Scatter the toasted seeds over the yoghurt so every spoonful gets some crunch.",
    "Drizzle the honey over the top and serve; add the seeds just before eating if you are making it ahead."
  ]
};
