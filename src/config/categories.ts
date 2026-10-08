import {
  Armchair, Baby, BedDouble, Beef, Bike, BookOpen, Briefcase, Building2, Cable, Camera, Car, ChefHat, Cog,
  Dumbbell, Footprints, Gamepad2, Gem, Gift, GraduationCap, Hammer, HandHelping, Home, Landmark, Laptop,
  Layers, Lightbulb, Music, Package, Palette, PartyPopper, PawPrint, Printer, Refrigerator, Scissors,
  Search, Shirt, ShoppingBag, Smartphone, Sparkles, Sprout, Store, Sun, Tractor, Trophy, Truck, Tv,
  Wheat, Wrench, type LucideIcon,
} from 'lucide-react';

export interface Category {
  slug: string;
  label: string;
  group: string;
  icon: LucideIcon;
  /** Examples shown on the sell form. */
  hint: string;
  /** Show the "condition" field (false for jobs, services, produce, property...). Default true. */
  goods?: boolean;
  priceLabel?: string;
  priceSuffix?: string;
  photosOptional?: boolean;
  /** Listings involve people, so the poster must confirm everyone involved is 18 or over. */
  adultOnly?: boolean;
  /** Category-specific safety advice shown on listings and in the sell form. */
  notice?: string;
}

const PHONE_NOTICE =
  'Dial *#06# to check the IMEI matches the box and the phone settings. Test calls, camera, charging and the screen before you pay, and ask for the receipt or proof of ownership.';
const VEHICLE_NOTICE =
  "Ask to see the original logbook and the seller's ID and make sure the names match. Do an official NTSA search on the registration number and have a mechanic inspect the vehicle. Do not pay a deposit before you have done all of this.";
const COMPUTER_NOTICE =
  'Ask for proof of purchase, check the serial number, and test the battery, keyboard, ports and screen before you pay.';
const WORK_NOTICE =
  'Agree the price and the scope of work first. Pay at most a small amount upfront and the rest when the work is done.';

export const categories: Category[] = [
  // Phones & electronics
  { slug: 'phones', label: 'Phones & tablets', group: 'Phones & electronics', icon: Smartphone, hint: 'Smartphones, feature phones, tablets', notice: PHONE_NOTICE },
  { slug: 'phone-accessories', label: 'Phone accessories', group: 'Phones & electronics', icon: Cable, hint: 'Chargers, cases, earphones, power banks' },
  { slug: 'computers', label: 'Laptops & computers', group: 'Phones & electronics', icon: Laptop, hint: 'Laptops, desktops, monitors', notice: COMPUTER_NOTICE },
  { slug: 'computer-accessories', label: 'Computer accessories', group: 'Phones & electronics', icon: Printer, hint: 'Printers, routers, keyboards, flash disks', notice: COMPUTER_NOTICE },
  { slug: 'tvs-audio', label: 'TVs & audio', group: 'Phones & electronics', icon: Tv, hint: 'TVs, decoders, radios, speakers, home theatres', notice: 'Plug it in and check the picture and sound before you pay. Ask for the remote and any receipt.' },
  { slug: 'cameras', label: 'Cameras', group: 'Phones & electronics', icon: Camera, hint: 'Cameras, lenses, tripods, drones' },
  { slug: 'gaming', label: 'Gaming', group: 'Phones & electronics', icon: Gamepad2, hint: 'Consoles, controllers, games' },
  { slug: 'solar-power', label: 'Solar & power', group: 'Phones & electronics', icon: Sun, hint: 'Solar panels, inverters, batteries, generators' },

  // Home & living
  { slug: 'furniture', label: 'Furniture', group: 'Home & living', icon: Armchair, hint: 'Sofas, tables, chairs, wardrobes, shelves' },
  { slug: 'appliances', label: 'Home appliances', group: 'Home & living', icon: Refrigerator, hint: 'Fridges, cookers, microwaves, washing machines' },
  { slug: 'kitchenware', label: 'Kitchenware', group: 'Home & living', icon: ChefHat, hint: 'Sufurias, plates, flasks, utensils' },
  { slug: 'beds-bedding', label: 'Beds & bedding', group: 'Home & living', icon: BedDouble, hint: 'Beds, mattresses, blankets, nets' },
  { slug: 'decor', label: 'Decor, curtains & carpets', group: 'Home & living', icon: Lightbulb, hint: 'Curtains, carpets, lamps, wall art' },
  { slug: 'building-materials', label: 'Building materials', group: 'Home & living', icon: Layers, hint: 'Iron sheets, timber, doors, windows, tiles' },
  { slug: 'tools', label: 'Tools & equipment', group: 'Home & living', icon: Hammer, hint: 'Power tools, hand tools, ladders' },

  // Fashion & baby
  { slug: 'clothing-women', label: "Women's clothing", group: 'Fashion & baby', icon: Shirt, hint: 'Dresses, tops, skirts, suits' },
  { slug: 'clothing-men', label: "Men's clothing", group: 'Fashion & baby', icon: Shirt, hint: 'Shirts, trousers, suits, jackets' },
  { slug: 'clothing-kids', label: "Kids' clothing", group: 'Fashion & baby', icon: Shirt, hint: 'Clothes and shoes for children' },
  { slug: 'shoes', label: 'Shoes', group: 'Fashion & baby', icon: Footprints, hint: 'Sneakers, boots, sandals, heels' },
  { slug: 'bags', label: 'Bags & luggage', group: 'Fashion & baby', icon: ShoppingBag, hint: 'Handbags, backpacks, suitcases' },
  { slug: 'jewellery-watches', label: 'Jewellery & watches', group: 'Fashion & baby', icon: Gem, hint: 'Watches, rings, necklaces' },
  { slug: 'baby', label: 'Baby & toys', group: 'Fashion & baby', icon: Baby, hint: 'Prams, cots, car seats, toys' },

  // Vehicles
  { slug: 'cars', label: 'Cars', group: 'Vehicles', icon: Car, hint: 'Saloons, SUVs, pickups, hatchbacks', notice: VEHICLE_NOTICE },
  { slug: 'motorbikes', label: 'Motorbikes', group: 'Vehicles', icon: Bike, hint: 'Boda bodas, scooters, dirt bikes', notice: VEHICLE_NOTICE },
  { slug: 'trucks-vans', label: 'Trucks, vans & buses', group: 'Vehicles', icon: Truck, hint: 'Lorries, matatus, vans, pickups', notice: VEHICLE_NOTICE },
  { slug: 'bicycles', label: 'Bicycles', group: 'Vehicles', icon: Bike, hint: 'Mountain bikes, road bikes, kids bikes' },
  { slug: 'vehicle-parts', label: 'Vehicle parts & accessories', group: 'Vehicles', icon: Cog, hint: 'Tyres, batteries, spare parts, car audio' },

  // School & books
  { slug: 'school-items', label: 'School items & uniforms', group: 'School & books', icon: GraduationCap, hint: 'Uniforms, school bags, geometry sets, lab coats' },
  { slug: 'books', label: 'Books & stationery', group: 'School & books', icon: BookOpen, hint: 'Textbooks, set books, novels, stationery' },

  // Farm & animals
  { slug: 'farm-produce', label: 'Farm produce', group: 'Farm & animals', icon: Wheat, hint: 'Maize, beans, bananas, avocados, vegetables, honey', goods: false, notice: 'Agree the quantity, price and who delivers before you pay, and look at a sample first.' },
  { slug: 'livestock', label: 'Livestock & poultry', group: 'Farm & animals', icon: Beef, hint: 'Cattle, goats, sheep, chickens, rabbits', goods: false, notice: 'See the animal in person and check its health. Ask about ownership and any movement permit that applies, and pay only after you have seen it.' },
  { slug: 'farm-machinery', label: 'Farm machinery & tools', group: 'Farm & animals', icon: Tractor, hint: 'Tractors, sprayers, water pumps, irrigation kits' },
  { slug: 'farm-inputs', label: 'Seeds, feeds & inputs', group: 'Farm & animals', icon: Sprout, hint: 'Seedlings, seeds, fertiliser, animal feed', goods: false },
  { slug: 'pets', label: 'Pets & supplies', group: 'Farm & animals', icon: PawPrint, hint: 'Dogs, cats, cages, pet food', goods: false },

  // Property
  { slug: 'property-rent', label: 'Houses & rooms to rent', group: 'Property', icon: Home, hint: 'Bedsitters, apartments, rooms, houses', goods: false, priceLabel: 'Rent per month (KSh)', priceSuffix: '/month', notice: 'Do not pay a deposit or "viewing fee" before you have seen the place and met the person who can legally let it. Ask for a written tenancy agreement.' },
  { slug: 'property-sale', label: 'Land & property for sale', group: 'Property', icon: Landmark, hint: 'Plots, farms, houses', goods: false, notice: 'Do an official land search (Ardhisasa or the land registry) to confirm the owner before paying anything. Use an advocate for the sale agreement and pay through the advocate or a bank, not in cash.' },
  { slug: 'commercial-property', label: 'Shops & business premises', group: 'Property', icon: Store, hint: 'Shops, stalls, offices and stores to rent or sell', goods: false, notice: 'Confirm who owns or manages the premises and get any agreement in writing before you pay.' },

  // Jobs & services
  { slug: 'house-help', label: 'House helps & domestic workers', group: 'Jobs & services', icon: HandHelping, hint: 'Cleaners, nannies, cooks, gardeners, caretakers', goods: false, priceLabel: 'Monthly pay (KSh)', priceSuffix: '/month', photosOptional: true, adultOnly: true, notice: 'Only people aged 18 or over may be listed. Check the national ID, speak to previous employers, and agree the terms in writing. Never pay a "placement" or "registration" fee to someone you have not met. Report anyone who looks underage or under pressure.' },
  { slug: 'jobs', label: 'Jobs & casual work', group: 'Jobs & services', icon: Briefcase, hint: 'Vacancies and people looking for work', goods: false, priceLabel: 'Pay (KSh)', photosOptional: true, adultOnly: true, notice: 'A real employer never asks you to pay to get a job. Meet in a public place and tell someone where you are going.' },
  { slug: 'services', label: 'Services', group: 'Jobs & services', icon: Wrench, hint: 'Plumbers, electricians, mechanics, tutors, tailors, photographers', goods: false, priceLabel: 'Price or rate (KSh)', photosOptional: true, notice: WORK_NOTICE },
  { slug: 'construction', label: 'Construction & repairs', group: 'Jobs & services', icon: Building2, hint: 'Masons, painters, roofing, fundis', goods: false, priceLabel: 'Price or rate (KSh)', photosOptional: true, notice: WORK_NOTICE },
  { slug: 'cleaning', label: 'Cleaning services', group: 'Jobs & services', icon: Sparkles, hint: 'Home, office and car cleaning', goods: false, priceLabel: 'Price or rate (KSh)', photosOptional: true, notice: WORK_NOTICE },
  { slug: 'events', label: 'Event hire & equipment', group: 'Jobs & services', icon: PartyPopper, hint: 'Tents, chairs, PA systems, decor, catering equipment', goods: false, photosOptional: true, notice: 'Agree what is included, the date and any deposit in writing. Check the equipment before the event.' },
  { slug: 'beauty', label: 'Beauty & personal care', group: 'Jobs & services', icon: Scissors, hint: 'Salon equipment, cosmetics, hair products', notice: 'Check that sealed products are really sealed and have not expired.' },

  // Business & hobbies
  { slug: 'business-equipment', label: 'Business & office equipment', group: 'Business & hobbies', icon: Briefcase, hint: 'Shelves, counters, welding machines, posho mills, POS' },
  { slug: 'health-fitness', label: 'Health & fitness', group: 'Business & hobbies', icon: Dumbbell, hint: 'Gym equipment, wheelchairs, walking aids (no medicines)' },
  { slug: 'sports', label: 'Sports & outdoors', group: 'Business & hobbies', icon: Trophy, hint: 'Balls, kits, camping gear' },
  { slug: 'music', label: 'Musical instruments', group: 'Business & hobbies', icon: Music, hint: 'Guitars, keyboards, drums, amplifiers' },
  { slug: 'art-crafts', label: 'Art, crafts & collectibles', group: 'Business & hobbies', icon: Palette, hint: 'Paintings, handmade goods, antiques' },

  // Other
  { slug: 'free', label: 'Free stuff', group: 'Other', icon: Gift, hint: 'Things you want to give away' },
  { slug: 'wanted', label: 'Wanted', group: 'Other', icon: Search, hint: 'Tell people what you are looking for', goods: false, priceLabel: 'Your budget (KSh)', photosOptional: true, notice: 'Never send money to someone who says they can supply what you want before you have seen it.' },
  { slug: 'other', label: 'Everything else', group: 'Other', icon: Package, hint: 'Anything that does not fit above' },
];

export const defaultNotice =
  'Meet in a busy public place in daylight, inspect the item before you pay, and pay only when you are happy. Never share your M-Pesa PIN or any code.';

const bySlug = new Map(categories.map((c) => [c.slug, c]));
const fallback = bySlug.get('other') as Category;

export function getCategory(slug: string): Category {
  return bySlug.get(slug) ?? fallback;
}

export function isValidCategory(slug: string): boolean {
  return bySlug.has(slug);
}

export const categoryGroups: { name: string; items: Category[] }[] = (() => {
  const order: string[] = [];
  const map = new Map<string, Category[]>();
  for (const c of categories) {
    if (!map.has(c.group)) {
      map.set(c.group, []);
      order.push(c.group);
    }
    map.get(c.group)?.push(c);
  }
  return order.map((name) => ({ name, items: map.get(name) ?? [] }));
})();

/** Categories shown in the quick rail under the header. */
export const featuredCategorySlugs = [
  'phones', 'farm-produce', 'furniture', 'cars', 'services',
];
