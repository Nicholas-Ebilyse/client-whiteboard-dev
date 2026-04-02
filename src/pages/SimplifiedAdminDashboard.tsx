import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Shield, UserPlus, Settings } from "lucide-react";
import { SyncGoogleSheetsButton } from "@/components/SyncGoogleSheetsButton";
import { SyncGoogleCalendarButton } from "@/components/SyncGoogleCalendarButton";
import { SyncStatusDisplay } from "@/components/SyncStatusDisplay";
import { CreateUserDialog } from "@/components/CreateUserDialog";
import { useMaxAssignmentsPerPeriod, useUpdateAppSetting } from "@/hooks/useAppSettings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { DatabaseExportButtons } from "@/components/DatabaseExportButtons";

interface UserWithRole {
  id: string;
  email: string;
  created_at: string;
  is_admin: boolean;
  is_suspended: boolean;
  suspension_reason: string | null;
}

export default function SimplifiedAdminDashboard() {
  const navigate = useNavigate();
  const { user, session, isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    userId: string;
    email: string;
    action: 'grant' | 'revoke' | 'suspend' | 'unsuspend';
  }>({ open: false, userId: '', email: '', action: 'grant' });
  const [suspensionReason, setSuspensionReason] = useState('');

  // App settings
  const { maxAssignments, isLoading: settingsLoading } = useMaxAssignmentsPerPeriod();
  const updateSetting = useUpdateAppSetting();
  const [maxAssignmentsInput, setMaxAssignmentsInput] = useState<string>('');

  // Initialize max assignments input when loaded
  useEffect(() => {
    if (!settingsLoading && maxAssignments) {
      setMaxAssignmentsInput(String(maxAssignments));
    }
  }, [maxAssignments, settingsLoading]);

  const handleSaveMaxAssignments = () => {
    const value = parseInt(maxAssignmentsInput);
    if (isNaN(value) || value < 1 || value > 10) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Le nombre doit être entre 1 et 10",
      });
      return;
    }

    updateSetting.mutate(
      { key: 'max_assignments_per_period', value },
      {
        onSuccess: () => {
          toast({ title: "Succès", description: "Paramètre mis à jour" });
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Erreur",
            description: "Impossible de mettre à jour le paramètre",
          });
        },
      }
    );
  };

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/');
    }
  }, [isAdmin, loading, navigate]);

  useEffect(() => {
    if (isAdmin && session) {
      loadData();
    }
  }, [isAdmin, session]);

  const loadData = async () => {
    await loadUsers();
  };

  const loadUsers = async () => {
    if (!session?.access_token) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Session non disponible. Veuillez vous reconnecter.",
      });
      return;
    }

    setLoadingUsers(true);
    try {
      const { data, error } = await supabase.functions.invoke('list-users', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error + (data.details ? `: ${data.details}` : ''));

      setUsers(data.users || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error?.message || "Impossible de charger les utilisateurs",
      });
    }
    setLoadingUsers(false);
  };

  const handleGrantAdmin = (userId: string, email: string) => {
    setActionDialog({ open: true, userId, email, action: 'grant' });
  };

  const handleRevokeAdmin = (userId: string, email: string) => {
    setActionDialog({ open: true, userId, email, action: 'revoke' });
  };

  const handleSuspendUser = (userId: string, email: string) => {
    setActionDialog({ open: true, userId, email, action: 'suspend' });
    setSuspensionReason('');
  };

  const handleUnsuspendUser = (userId: string, email: string) => {
    setActionDialog({ open: true, userId, email, action: 'unsuspend' });
  };

  // --- THE FIX IS HERE --- 
  // We route all requests to the single 'manage-user' edge function
  const executeAction = async () => {
    const { userId, email, action } = actionDialog;

    try {
      if (action === 'suspend') {
        if (!suspensionReason.trim()) {
          toast({ variant: "destructive", title: "Erreur", description: "Veuillez fournir une raison pour la suspension" });
          return;
        }
        if (suspensionReason.length > 500) {
          toast({ variant: "destructive", title: "Erreur", description: "La raison doit faire moins de 500 caractères" });
          return;
        }
      }

      // Call our unified Edge Function!
      const { data, error } = await supabase.functions.invoke('manage-user', {
        body: { userId, action, reason: suspensionReason },
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });

      if (error) throw error;
      if (data && data.error) throw new Error(data.error);

      // Show success message
      const messages = {
        grant: `${email} est maintenant administrateur.`,
        revoke: `${email} n'est plus administrateur.`,
        suspend: `${email} a été suspendu.`,
        unsuspend: `${email} a été réactivé.`,
      };

      toast({ title: "Succès", description: messages[action as keyof typeof messages] });

      if (action === 'suspend') setSuspensionReason('');
      setActionDialog({ open: false, userId: '', email: '', action: 'grant' });

      await new Promise(resolve => setTimeout(resolve, 1000));
      await loadUsers();
    } catch (error) {
      console.error('Error executing action:', error);
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'effectuer l'action" });
      setActionDialog({ open: false, userId: '', email: '', action: 'grant' });
    }
  };

  if (loading || !isAdmin) {
    return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <h1 className="text-3xl font-bold">Gestion des utilisateurs</h1>
          </div>
          <Button onClick={() => setCreateUserOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Créer un utilisateur
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Utilisateurs ({users.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Date de création</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingUsers ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      <TableCell>{new Date(u.created_at).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell>
                        {u.is_admin ? (
                          <Badge variant="default">
                            <Shield className="h-3 w-3 mr-1" />
                            Admin
                          </Badge>
                        ) : (
                          <Badge variant="outline">Utilisateur</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.is_suspended ? (
                          <Badge variant="destructive">Suspendu</Badge>
                        ) : (
                          <Badge variant="secondary">Actif</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {!u.is_admin && !u.is_suspended && (
                          <Button size="sm" variant="outline" onClick={() => handleGrantAdmin(u.id, u.email)}>
                            Accorder Admin
                          </Button>
                        )}
                        {u.is_admin && u.email !== user?.email && (
                          <Button size="sm" variant="outline" onClick={() => handleRevokeAdmin(u.id, u.email)}>
                            Révoquer Admin
                          </Button>
                        )}
                        {!u.is_suspended && u.email !== user?.email && (
                          <Button size="sm" variant="destructive" onClick={() => handleSuspendUser(u.id, u.email)}>
                            Suspendre
                          </Button>
                        )}
                        {u.is_suspended && (
                          <Button size="sm" variant="default" onClick={() => handleUnsuspendUser(u.id, u.email)}>
                            Réactiver
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Paramètres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxAssignments">
                  Nombre maximum d'affectations par période
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="maxAssignments"
                    type="number"
                    min={1}
                    max={10}
                    value={maxAssignmentsInput}
                    onChange={(e) => setMaxAssignmentsInput(e.target.value)}
                    className="w-20"
                    disabled={settingsLoading}
                  />
                  <span className="text-sm text-muted-foreground">
                    (actuellement: {maxAssignments})
                  </span>
                </div>
              </div>
              <Button onClick={handleSaveMaxAssignments} disabled={updateSetting.isPending || settingsLoading}>
                Enregistrer
              </Button>
            </div>
          </CardContent>
        </Card>

        <DatabaseExportButtons />

        <div className="flex flex-col gap-4 pt-4 border-t">
          <div className="flex items-center justify-between gap-4">
            <SyncGoogleSheetsButton />
            <SyncGoogleCalendarButton />
          </div>
          <SyncStatusDisplay />
        </div>

        <AlertDialog open={actionDialog.open} onOpenChange={(open) => !open && setActionDialog({ open: false, userId: '', email: '', action: 'grant' })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {actionDialog.action === 'grant' && 'Accorder les droits admin'}
                {actionDialog.action === 'revoke' && 'Révoquer les droits admin'}
                {actionDialog.action === 'suspend' && 'Suspendre l\'utilisateur'}
                {actionDialog.action === 'unsuspend' && 'Réactiver l\'utilisateur'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {actionDialog.action === 'grant' && `Êtes-vous sûr de vouloir accorder les droits administrateur à ${actionDialog.email} ?`}
                {actionDialog.action === 'revoke' && `Êtes-vous sûr de vouloir révoquer les droits administrateur de ${actionDialog.email} ?`}
                {actionDialog.action === 'suspend' && (
                  <div className="space-y-4">
                    <p>Êtes-vous sûr de vouloir suspendre {actionDialog.email} ?</p>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Raison de la suspension</label>
                      <Textarea
                        value={suspensionReason}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value.length <= 500) {
                            setSuspensionReason(value);
                          }
                        }}
                        placeholder="Entrez la raison de la suspension..."
                        rows={3}
                        maxLength={500}
                      />
                      <p className="text-xs text-muted-foreground">
                        {suspensionReason.length}/500 caractères
                      </p>
                    </div>
                  </div>
                )}
                {actionDialog.action === 'unsuspend' && `Êtes-vous sûr de vouloir réactiver ${actionDialog.email} ?`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={executeAction}>Confirmer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <CreateUserDialog
          open={createUserOpen}
          onOpenChange={setCreateUserOpen}
          onUserCreated={loadUsers}
        />
      </div>
    </div>
  );
}