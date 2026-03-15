import { Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const AdminBadge = () => {
  const navigate = useNavigate();
  
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="default" 
            className="gap-1 cursor-pointer hover:bg-primary/90 transition-colors"
            onClick={() => navigate('/admin')}
          >
            <Shield className="h-3 w-3" />
            Admin
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={5}>
          Tableau de bord admin
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
