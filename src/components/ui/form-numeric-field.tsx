import { Control } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FormNumericFieldProps {
  control: Control<any>;
  name: string;
  label: string | React.ReactNode;
  placeholder?: string;
  description?: string | React.ReactNode;
  step?: string;
  className?: string;
}

export function FormNumericField({ 
  control, 
  name, 
  label, 
  placeholder, 
  description, 
  step = "0.01", 
  className 
}: FormNumericFieldProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn("space-y-2", className)}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input 
              type="number" 
              step={step} 
              placeholder={placeholder} 
              {...field} 
              onChange={(e) => {
                const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                field.onChange(val);
              }}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
