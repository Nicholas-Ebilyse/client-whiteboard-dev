import { useState } from 'react';
import { SearchableSelect } from '@/components/SearchableSelect';
import { Card } from '@/components/ui/card';

// Generate test data with many options to force scrolling
const testOptions = Array.from({ length: 50 }, (_, i) => ({
  value: `option-${i + 1}`,
  label: `Test Option ${i + 1}`,
}));

export default function TestDropdown() {
  const [selectedValue, setSelectedValue] = useState('');

  return (
    <div className="min-h-screen p-8 bg-background">
      <Card className="max-w-md mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-bold">Test Dropdown Scrolling</h1>
        <p className="text-sm text-muted-foreground">
          This dropdown has 50 options. It should scroll when opened.
        </p>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Select an option:</label>
          <SearchableSelect
            value={selectedValue}
            onValueChange={setSelectedValue}
            options={testOptions}
            placeholder="Search test options..."
          />
        </div>

        {selectedValue && (
          <div className="p-4 bg-muted rounded-md">
            <p className="text-sm">
              <strong>Selected:</strong> {selectedValue}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
