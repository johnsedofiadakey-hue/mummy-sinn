import type { Category, MenuItem, PreorderSlot } from "@/types/domain";

// Display-only shapes for the sample data. They mirror `deliveryLocations` and `settings/public`
// in docs/firestore-data-model.md; the trusted server remains authoritative for fees and availability.
export interface DeliveryLocation { id: string; name: string; area: string; deliveryFee: number; isActive: boolean; sortOrder: number; }
export interface PublicSettings { acceptingOrders: boolean; asapEnabled: boolean; asapWindow: string; notice: string | null; supportPhone: string | null; }

export const categories: Category[] = [
  { id: "rice", name: "Rice", emoji: "🍚", sortOrder: 1, isActive: true },
  { id: "local", name: "Local", emoji: "🍲", sortOrder: 2, isActive: true },
  { id: "chicken", name: "Chicken", emoji: "🍗", sortOrder: 3, isActive: true },
  { id: "snacks", name: "Snacks", emoji: "🥟", sortOrder: 4, isActive: true },
  { id: "drinks", name: "Drinks", emoji: "🥤", sortOrder: 5, isActive: true },
];

const extras = { id: "extras", name: "Make it yours", required: false, min: 0, max: 3, options: [
  { id: "plantain", name: "Sweet plantain", priceAdjustment: 7 }, { id: "egg", name: "Fried egg", priceAdjustment: 5 }, { id: "protein", name: "Extra chicken", priceAdjustment: 12 },
] };
const spice = { id: "spice", name: "How much pepper?", required: true, min: 1, max: 1, options: [
  { id: "mild", name: "Mild", priceAdjustment: 0 }, { id: "medium", name: "Medium", priceAdjustment: 0, isDefault: true }, { id: "hot", name: "Hot", priceAdjustment: 0 },
] };

export const menuItems: MenuItem[] = [
  { id: "jollof-chicken", slug: "jollof-grilled-chicken", name: "Jollof + grilled chicken", description: "Smoky Ghanaian jollof, flame-grilled chicken and our house shito.", price: 35, categoryId: "rice", imageUrl: "https://images.unsplash.com/photo-1631515242808-497c3fbd3972?auto=format&fit=crop&w=1000&q=85", prepMinutes: 20, badge: "Bestseller", isAvailable: true, modifierGroups: [spice, extras], tags: ["Popular", "Lunch"] },
  { id: "fried-rice", slug: "chicken-fried-rice", name: "Chicken fried rice", description: "Colourful wok fried rice, vegetables and tender chicken strips.", price: 32, categoryId: "rice", imageUrl: "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=1000&q=85", prepMinutes: 18, badge: "Hot right now", isAvailable: true, modifierGroups: [spice, extras], tags: ["Popular"] },
  { id: "waakye", slug: "waakye-special", name: "Waakye special", description: "Rice and beans with spaghetti, egg, fish and rich stew.", price: 30, categoryId: "local", imageUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1000&q=85", prepMinutes: 15, isAvailable: true, modifierGroups: [spice, extras], tags: ["Local favourite"] },
  { id: "noodles", slug: "loaded-noodles", name: "Loaded noodles", description: "Quick stir-fried noodles, vegetables and a juicy chicken thigh.", price: 28, categoryId: "chicken", imageUrl: "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?auto=format&fit=crop&w=1000&q=85", prepMinutes: 12, badge: "Under GHS 30", isAvailable: true, modifierGroups: [spice, extras], tags: ["Quick bites"] },
  { id: "kebab", slug: "suya-chicken-kebab", name: "Suya chicken kebab", description: "Charred chicken skewers, suya spice and fresh pepper relish.", price: 24, categoryId: "snacks", imageUrl: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=1000&q=85", prepMinutes: 10, isAvailable: false, modifierGroups: [spice], tags: ["Snack"] },
  { id: "sobolo", slug: "cold-sobolo", name: "Cold sobolo", description: "Hibiscus, pineapple and ginger. Properly chilled.", price: 10, categoryId: "drinks", imageUrl: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=1000&q=85", prepMinutes: 2, isAvailable: true, modifierGroups: [], tags: ["Drink"] },
];

export const preorderSlots: PreorderSlot[] = [
  { id: "today-1200", serviceDate: "Today", label: "12:00 – 12:30", startsAt: "12:00", endsAt: "12:30", availableCapacity: 12, totalCapacity: 30, isOpen: true },
  { id: "today-1230", serviceDate: "Today", label: "12:30 – 1:00", startsAt: "12:30", endsAt: "13:00", availableCapacity: 3, totalCapacity: 30, isOpen: true },
  { id: "today-1300", serviceDate: "Today", label: "1:00 – 1:30", startsAt: "13:00", endsAt: "13:30", availableCapacity: 16, totalCapacity: 30, isOpen: true },
  { id: "today-1330", serviceDate: "Today", label: "1:30 – 2:00", startsAt: "13:30", endsAt: "14:00", availableCapacity: 0, totalCapacity: 30, isOpen: false },
  { id: "today-1800", serviceDate: "Today", label: "6:00 – 6:30", startsAt: "18:00", endsAt: "18:30", availableCapacity: 20, totalCapacity: 30, isOpen: true },
  { id: "tomorrow-1200", serviceDate: "Tomorrow", label: "12:00 – 12:30", startsAt: "12:00", endsAt: "12:30", availableCapacity: 24, totalCapacity: 30, isOpen: true },
  { id: "tomorrow-1230", serviceDate: "Tomorrow", label: "12:30 – 1:00", startsAt: "12:30", endsAt: "13:00", availableCapacity: 26, totalCapacity: 30, isOpen: true },
  { id: "tomorrow-1800", serviceDate: "Tomorrow", label: "6:00 – 6:30", startsAt: "18:00", endsAt: "18:30", availableCapacity: 30, totalCapacity: 30, isOpen: true },
];

// Sample halls/hostels until real delivery zones and fees are supplied.
export const deliveryLocations: DeliveryLocation[] = [
  { id: "pentagon", name: "Pentagon Hostel", area: "Legon", deliveryFee: 5, isActive: true, sortOrder: 1 },
  { id: "legon-hall", name: "Legon Hall", area: "Legon", deliveryFee: 5, isActive: true, sortOrder: 2 },
  { id: "commonwealth", name: "Commonwealth Hall", area: "Legon", deliveryFee: 5, isActive: true, sortOrder: 3 },
  { id: "akuafo", name: "Akuafo Hall", area: "Legon", deliveryFee: 5, isActive: true, sortOrder: 4 },
  { id: "volta", name: "Volta Hall", area: "Legon", deliveryFee: 5, isActive: true, sortOrder: 5 },
  { id: "sarbah", name: "Mensah Sarbah Hall", area: "Legon", deliveryFee: 5, isActive: true, sortOrder: 6 },
  { id: "jean-nelson", name: "Jean Nelson Aka Hall", area: "Legon", deliveryFee: 6, isActive: true, sortOrder: 7 },
  { id: "evandy", name: "Evandy Hostel", area: "Off-campus", deliveryFee: 7, isActive: true, sortOrder: 8 },
  { id: "bani", name: "Bani Hostel", area: "Off-campus", deliveryFee: 7, isActive: true, sortOrder: 9 },
];

// Sample of `settings/public`. supportPhone stays null until Mummy's Inn supplies a real number.
export const publicSettings: PublicSettings = { acceptingOrders: true, asapEnabled: true, asapWindow: "25–35 min", notice: null, supportPhone: null };

export const money = (amount: number) => `GHS ${amount.toFixed(2)}`;
