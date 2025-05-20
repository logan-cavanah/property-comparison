'use client';

import { useEffect, useRef, useState } from 'react';
import { loader } from '@/lib/utils/googleMaps';
import { MapPin } from 'lucide-react';

interface AddressInputProps {
  value: string;
  onChange: (address: string) => void;
  onValidityChange?: (isValid: boolean) => void;
  placeholder?: string;
  label?: string;
  helperText?: string;
}

export default function AddressInput({ 
  value, 
  onChange,
  onValidityChange,
  placeholder = "Enter address", 
  label = "Address",
  helperText
}: AddressInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [autocomplete, setAutocomplete] = useState<any>(null);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const initAutocomplete = async () => {
      try {
        const { Autocomplete } = await loader.importLibrary('places');
        if (inputRef.current) {
          const autocompleteInstance = new Autocomplete(inputRef.current, {
            types: ['address'],
            componentRestrictions: { country: 'uk' },
            fields: ['formatted_address', 'geometry', 'name']
          });

          autocompleteInstance.addListener('place_changed', () => {
            const place = autocompleteInstance.getPlace();
            if (place.formatted_address) {
              onChange(place.formatted_address);
              setIsValid(true);
              onValidityChange?.(true);
            }
          });

          // Add listener for manual input changes
          inputRef.current.addEventListener('input', () => {
            setIsValid(false);
            onValidityChange?.(false);
          });

          setAutocomplete(autocompleteInstance);
        }
      } catch (error) {
        console.error('Error initializing Google Places Autocomplete:', error);
      }
    };

    initAutocomplete();
  }, [onChange, onValidityChange]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
        <MapPin className="mr-1" size={16} />
        {label}
      </label>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-4 py-2 border ${isValid ? 'border-green-500' : 'border-gray-300'} rounded-md focus:ring-blue-500 focus:border-blue-500`}
      />
      {helperText && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
      {!isValid && value && (
        <p className="mt-1 text-sm text-red-500">Please select a valid address from the suggestions</p>
      )}
    </div>
  );
} 