import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserCreated: () => void;
}

export function CreateUserDialog({ open, onOpenChange, onUserCreated }: CreateUserDialogProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateUser = async (e?: React.MouseEvent) => {
    // The Iron Cage: Prevent accidental form submissions!
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!email || !password) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Format d'email invalide");
      return;
    }

    if (email.length > 255) {
      toast.error("L'email doit faire moins de 255 caractères");
      return;
    }

    if (password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email,
          password,
          role
        }
      });

      if (error) {
        let errorMessage = error instanceof Error ? error.message : String(error);
        if (error instanceof Error && error.name === 'FunctionsHttpError' && 'context' in error) {
          const context = error.context as Response;
          const errorBody = await context.json().catch(() => null);
          errorMessage = (errorBody?.error || errorBody?.message || errorMessage) + (errorBody?.stage ? ` (Stage: ${errorBody.stage})` : '');
        }
        throw new Error(errorMessage);
      }

      // THE FIX: We check if the backend explicitly sent an error. 
      // We removed the `!data?.success` check because our Edge Function returns the raw user object!
      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success(`Compte créé avec succès pour ${email}`);
      setEmail("");
      setPassword("");
      setRole("user");
      onUserCreated();
      onOpenChange(false);
    } catch (error: unknown) {
      console.error("Error creating user:", error);
      const err = error as Error;
      toast.error(err.message || "Erreur lors de la création du compte");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer un nouveau compte utilisateur</DialogTitle>
          <DialogDescription>
            Créez un compte et attribuez un rôle. Le mot de passe sera visible pour que vous puissiez le communiquer à l'utilisateur.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="utilisateur@exemple.com"
            />
          </div>
          <div>
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 caractères"
            />
            {password && (
              <p className="text-sm text-muted-foreground mt-1">
                Mot de passe: <span className="font-mono font-semibold">{password}</span>
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="role">Rôle</Label>
            <Select value={role} onValueChange={(value: "admin" | "user") => setRole(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Utilisateur</SelectItem>
                <SelectItem value="admin">Administrateur</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            onClick={handleCreateUser}
            disabled={isCreating}
            className="w-full"
          >
            {isCreating ? "Création..." : "Créer le compte"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}