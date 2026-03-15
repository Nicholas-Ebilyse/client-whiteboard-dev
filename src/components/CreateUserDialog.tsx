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

  const handleCreateUser = async () => {
    if (!email || !password) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Format d'email invalide");
      return;
    }

    // Validate email length
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
      // Call edge function to create user with service role
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email,
          password,
          role
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Erreur lors de la création de l'utilisateur");

      toast.success(`Compte créé avec succès pour ${email}`);
      setEmail("");
      setPassword("");
      setRole("user");
      onUserCreated();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error.message || "Erreur lors de la création du compte");
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
