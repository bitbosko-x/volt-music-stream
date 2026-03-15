import { Card } from '@/components/ui/card';
import { MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function CityCharts({ onCategoryClick }) {

    const cities = [
        { name: "Mumbai", query: "top songs mumbai" },
        { name: "Delhi", query: "top songs delhi" },
        { name: "Bangalore", query: "top songs bangalore" },
        { name: "Hyderabad", query: "top songs hyderabad" },
        { name: "Chennai", query: "top songs chennai" },
        { name: "Kolkata", query: "top songs kolkata" },
        { name: "Pune", query: "top songs pune" },
        { name: "Jaipur", query: "top songs jaipur" }
    ];

    return (
        <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                City Charts
            </h2>
            <div className="flex flex-wrap gap-3">
                {cities.map((city, idx) => (
                    <div
                        key={idx}
                        onClick={() => onCategoryClick({
                            id: `city_${city.name.toLowerCase()}`,
                            title: `Top Songs in ${city.name}`,
                            description: `Trending music in ${city.name}`,
                            query: city.query
                        })}
                        className="px-4 py-2 bg-secondary hover:bg-primary hover:text-primary-foreground rounded-full cursor-pointer transition-colors text-sm font-medium"
                    >
                        #{idx + 1} {city.name}
                    </div>
                ))}
            </div>
        </div>
    );
}
