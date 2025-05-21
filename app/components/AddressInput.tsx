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

interface Suggestion {
  mainText: string;
  secondaryText: string;
  placeId: string;
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
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isValid, setIsValid] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasAttemptedInput, setHasAttemptedInput] = useState(false);
  const sessionTokenRef = useRef<any>(null);

  useEffect(() => {
    const initAutocomplete = async () => {
      try {
        const { AutocompleteSessionToken, AutocompleteSuggestion } = await loader.importLibrary('places');
        sessionTokenRef.current = new AutocompleteSessionToken();

        const fetchSuggestions = async (input: string) => {
          if (!input.trim()) {
            setSuggestions([]);
            setIsValid(true);
            onValidityChange?.(true);
            return;
          }

          try {
            const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
              input,
              sessionToken: sessionTokenRef.current,
              includedRegionCodes: ['GB'],
              includedPrimaryTypes: ['street_address', 'route', 'locality', 'administrative_area_level_1', 'postal_code']
            });

            const formattedSuggestions = response.suggestions.map(suggestion => ({
              mainText: suggestion.placePrediction?.mainText?.text || '',
              secondaryText: suggestion.placePrediction?.secondaryText?.text || '',
              placeId: suggestion.placePrediction?.placeId || '',
            }));

            setSuggestions(formattedSuggestions);
            setShowSuggestions(true);
            setHasAttemptedInput(true);
          } catch (error) {
            console.error('Error fetching suggestions:', error);
            setSuggestions([]);
          }
        };

        if (inputRef.current) {
          inputRef.current.addEventListener('blur', () => {
            setTimeout(() => setShowSuggestions(false), 200);
          });
        }
      } catch (error) {
        console.error('Error initializing Google Places:', error);
      }
    };

    initAutocomplete();
  }, [onValidityChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    if (!newValue.trim()) {
      setSuggestions([]);
      setIsValid(true);
      onValidityChange?.(true);
      return;
    }

    const timeoutId = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  const fetchSuggestions = async (input: string) => {
    try {
      const { AutocompleteSuggestion } = await loader.importLibrary('places');
      const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        sessionToken: sessionTokenRef.current,
        includedRegionCodes: ['GB'],
        includedPrimaryTypes: ['street_address', 'route', 'locality', 'administrative_area_level_1', 'postal_code']
      });

      const formattedSuggestions = response.suggestions.map(suggestion => ({
        mainText: suggestion.placePrediction?.mainText?.text || '',
        secondaryText: suggestion.placePrediction?.secondaryText?.text || '',
        placeId: suggestion.placePrediction?.placeId || '',
      }));

      setSuggestions(formattedSuggestions);
      setShowSuggestions(true);
      setHasAttemptedInput(true);
      setIsValid(false);
      onValidityChange?.(false);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = async (suggestion: Suggestion) => {
    try {
      const { AutocompleteSuggestion } = await loader.importLibrary('places');
      const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: suggestion.mainText,
        sessionToken: sessionTokenRef.current,
        includedRegionCodes: ['GB'],
        includedPrimaryTypes: ['street_address', 'route', 'locality', 'administrative_area_level_1', 'postal_code']
      });

      const matchingSuggestion = response.suggestions.find(
        s => s.placePrediction?.placeId === suggestion.placeId
      );

      if (matchingSuggestion?.placePrediction) {
        const place = await matchingSuggestion.placePrediction.toPlace();
        const placeDetails = await place.fetchFields({
          fields: ['formattedAddress']
        });

        if (placeDetails.place?.formattedAddress) {
          onChange(placeDetails.place.formattedAddress);
          setIsValid(true);
          onValidityChange?.(true);
          setShowSuggestions(false);
        }
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
    }
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
        <MapPin className="mr-1" size={16} />
        {label}
      </label>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        className={`w-full px-4 py-2 border ${isValid ? 'border-green-500' : 'border-gray-300'} rounded-md focus:ring-blue-500 focus:border-blue-500`}
      />
      {helperText && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
      {!isValid && value && hasAttemptedInput && (
        <p className="mt-1 text-sm text-red-500">Please select a valid address from the suggestions</p>
      )}
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.placeId}
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <div className="font-medium">{suggestion.mainText}</div>
              <div className="text-sm text-gray-500">{suggestion.secondaryText}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 