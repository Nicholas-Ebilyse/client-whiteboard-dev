import { TechnicianHeader } from './TechnicianHeader';

interface TechnicianHeaderCellProps {
  name: string;
  isArchived?: boolean;
  backgroundColor?: string;
}

export const TechnicianHeaderCell = ({ 
  name, 
  isArchived,
  backgroundColor,
}: TechnicianHeaderCellProps) => {
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      <div className="flex items-center justify-center w-full">
        <TechnicianHeader name={name} isArchived={isArchived} backgroundColor={backgroundColor} />
      </div>
    </div>
  );
};
