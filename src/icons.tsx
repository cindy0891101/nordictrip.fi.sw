import {
  Car,
  Utensils,
  Camera,
  Bed,
  Star,
  ShoppingBag,
  MapPin
} from 'lucide-react';

export function getCategoryIcon(type: string) {
  switch (type) {
    case 'Transport': return <Car size={18} COLOR="RED" />;
    case 'Food': return <Utensils size={18} />;
    case 'Attraction': return <Camera size={18} />;
    case 'Accommodation': return <Bed size={18} />;
    case 'Activity': return <Star size={18} />;
    case 'Shopping': return <ShoppingBag size={18} />;
    default: return <MapPin size={18} />;
  }
}
