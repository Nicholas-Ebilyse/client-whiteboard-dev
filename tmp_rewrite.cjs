const fs = require('fs');
const filepath = 'src/components/EditAssignmentDialog.tsx';
let content = fs.readFileSync(filepath, 'utf8');

// 1. Update Props Interface
content = content.replace(
  /technicians: \{ id: string; name: string \}\[\];/,
  'teams: any[];'
);

// 2. Component signature
content = content.replace(
  /technicians,/g,
  'teams,'
);

// 3. State replacements
content = content.replace(
  /const \[selectedTechnician, setSelectedTechnician\] = useState\(assignment\?\.teamId \|\| ''\);\n  const \[selectedCommande, setSelectedCommande\] = useState\(assignment\?\.commandeId \|\| ''\);\n  const \[startDate, setStartDate\] = useState<Date \| undefined>\(\n    assignment \? new Date\(assignment\.startDate\) : today\n  \);\n  const \[endDate, setEndDate\] = useState<Date \| undefined>\(\n    assignment \? new Date\(assignment\.endDate\) : today\n  \);\n  const \[isAbsent, setIsAbsent\] = useState\(assignment\?\.isAbsent \|\| false\);\n  const \[isConfirmed, setIsConfirmed\] = useState\(assignment\?\.isConfirmed \|\| false\);\n  const \[absenceReason, setAbsenceReason\] = useState\(assignment\?\.comment \|\| ''\);\n  const \[hasSecondTech, setHasSecondTech\] = useState\(false\);\n  const \[secondTechnician, setSecondTechnician\] = useState\(''\);/g,
  `const [selectedTeam, setSelectedTeam] = useState(assignment?.teamId || '');
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedCommande, setSelectedCommande] = useState(assignment?.commandeId || '');
  const [startDate, setStartDate] = useState<Date | undefined>(
    assignment ? new Date(assignment.startDate) : today
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    assignment ? new Date(assignment.endDate) : today
  );
  const [isConfirmed, setIsConfirmed] = useState(assignment?.isConfirmed || false);
  const [comment, setComment] = useState(assignment?.comment || '');`
);

// 4. linkedTechnician & useEffect
content = content.replace(
  /  \/\/ Find linked technician from the same group[\s\S]*?\} \}, \[assignment\]\);/m,
  `  useEffect(() => {
    if (assignment) {
      setSelectedTeam(assignment.teamId || '');
      const initialCommande = assignment.commandeId ? commandes.find((c: any) => c.id === assignment.commandeId) : null;
      setSelectedClient(initialCommande?.client || '');
      setSelectedCommande(assignment.commandeId || '');
      setStartDate(new Date(assignment.startDate));
      setEndDate(new Date(assignment.endDate));
      setIsConfirmed(assignment.isConfirmed || false);
      setComment(assignment.comment || '');
    }
  }, [assignment, commandes]);`
);

// 5. checkAbsenceConflict and handleSave
const handleSaveNew = `  const { maxAssignments: MAX_ASSIGNMENTS_PER_PERIOD } = useMaxAssignmentsPerPeriod();

  const countAssignmentsInRange = (teamId: string, start: Date, end: Date): number => {
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');
    return assignments.filter(a => {
      if (a.teamId !== teamId) return false;
      if (assignment?.id === a.id) return false;
      const aStartStr = format(new Date(a.startDate), 'yyyy-MM-dd');
      const aEndStr = format(new Date(a.endDate), 'yyyy-MM-dd');
      return !(endStr < aStartStr || startStr > aEndStr);
    }).length;
  };

  const handleSave = () => {
    if (assignment && selectedTeam && selectedCommande && startDate && endDate) {
      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(endDate, 'yyyy-MM-dd');
      
      if (endDateStr < startDateStr) {
        toast({
          title: 'Erreur',
          description: 'La date de fin ne peut pas précéder la date de début.',
          variant: 'destructive',
        });
        return;
      }

      const count = countAssignmentsInRange(selectedTeam, startDate, endDate);
      if (count >= MAX_ASSIGNMENTS_PER_PERIOD) {
        const teamName = teams.find((t: any) => t.id === selectedTeam)?.name || 'L\\'équipe';
        toast({
          title: 'Limite d\\'affectations atteinte',
          description: \`\${teamName} a déjà le maximum d'affectations sur cette période.\`,
          variant: 'destructive',
        });
        return;
      }
      
      const updatedAssignment: Assignment = {
        ...assignment,
        teamId: selectedTeam,
        chantierId: null,
        commandeId: selectedCommande,
        startDate: startDateStr,
        endDate: endDateStr,
        startPeriod: 'Matin',
        endPeriod: 'Après-midi',
        isAbsent: false,
        isConfirmed,
        comment,
      };
      
      onSave(updatedAssignment);
      onOpenChange(false);
    }
  };`;

content = content.replace(
  /  const checkAbsenceConflict = [\s\S]*?    \}\n  \};\n/m,
  handleSaveNew + '\n'
);

// 6. Chantier Options replaces
content = content.replace(
  /  \/\/ Show only the client name in the trigger; the full chantier address is shown below\n  const chantierOptions = chantiers\.map\(c => \(\{\n    value: c\.id,\n    \/\/ c\.name is 'Client - Chantier'; we show only the client part for brevity\n    label: c\.name\.includes\(' - '\) \? c\.name\.split\(' - '\)\[0\] : c\.name,\n  \}\)\);\n/m,
  `  const clientOptions = useMemo(() => {
    const clients = Array.from(new Set(commandes.map((c: any) => c.client).filter(Boolean))) as string[];
    return clients.sort().map(client => ({ value: client, label: client }));
  }, [commandes]);

  const chantierOptions = useMemo(() => {
    if (!selectedClient) return [];
    return commandes
      .filter((c: any) => c.client === selectedClient && (!c.is_invoiced || c.id === assignment?.commandeId))
      .map((c: any) => ({
        value: c.id,
        label: c.chantier || c.name,
      }));
  }, [commandes, selectedClient, assignment?.commandeId]);
`
);

// 7. Render Block Replacements
content = content.replace(
  /<div className="space-y-2">\n\s*<Label htmlFor="technician">Technicien<\/Label>\n\s*<Select value=\{selectedTechnician\} onValueChange=\{setSelectedTechnician\}>\n[\s\S]*?\{\/\* Only show add second tech option if there's no linked technician already \*\/\}[\s\S]*?<\/div>\n\s*\)\}/m,
  `<div className="space-y-2">
            <Label htmlFor="team">Équipe</Label>
            <Select value={selectedTeam} disabled>
              <SelectTrigger id="team" className="bg-muted text-muted-foreground opacity-100">
                <SelectValue placeholder="Sélectionner une équipe" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team: any) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>`
);

content = content.replace(
  /<div className="space-y-2">\n\s*<div className="flex items-center justify-between mb-2">\n\s*<Label htmlFor="chantier">Chantier<\/Label>\n\s*<div className="flex items-center space-x-2">\n\s*<Checkbox \n\s*id="absent" \n\s*checked=\{isAbsent\}\n\s*disabled=\{isInvoiced\}\n\s*onCheckedChange=\{\(checked\) => setIsAbsent\(checked as boolean\)\}\n\s*\/>\n\s*<label htmlFor="absent" className="text-sm cursor-pointer">Absent<\/label>\n\s*<\/div>\n\s*<\/div>\n\s*\{isInvoiced && \(\n\s*<p className="text-xs text-red-600 font-medium flex items-center gap-1">\n\s*🔒 Ce chantier est marqué comme facturé — affectation verrouillée\.\n\s*<\/p>\n\s*\)\}\n\s*<SearchableSelect\n\s*value=\{selectedCommande\}\n\s*onValueChange=\{setSelectedCommande\}\n\s*options=\{chantierOptions\}\n\s*placeholder=\{isAbsent \? "Absent" : "Rechercher un client\.\.\."\}\n\s*disabled=\{isAbsent \|\| isInvoiced\}\n\s*\/>\n\s*<\/div>/m,
  `<div className="space-y-4">
            <div className="space-y-2">
              <Label>Client</Label>
              {isInvoiced && (
                <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                  🔒 Ce chantier est marqué comme facturé — affectation verrouillée.
                </p>
              )}
              <SearchableSelect
                value={selectedClient}
                onValueChange={(val) => {
                  setSelectedClient(val);
                  setSelectedCommande('');
                }}
                options={clientOptions}
                placeholder="Sélectionner un client..."
                disabled={isInvoiced}
              />
            </div>

            {selectedClient && (
              <div className="space-y-2">
                <Label>Chantier (Lieu/Adresse)</Label>
                <SearchableSelect
                  value={selectedCommande}
                  onValueChange={setSelectedCommande}
                  options={chantierOptions}
                  placeholder="Sélectionner un chantier..."
                  disabled={isInvoiced}
                />
              </div>
            )}
          </div>`
);

content = content.replace(
  /\{\!isAbsent && selectedCommande && \(\(\) => \{/gm,
  `{selectedCommande && (() => {`
);

content = content.replace(
  /\{\!isAbsent && selectedCommande && selectedChantier && \(/gm,
  `{selectedCommande && selectedChantier && (`
);

content = content.replace(
  /\{isAbsent && \(\n\s*<div className="space-y-2">\n\s*<Label htmlFor="absence-reason">Motif de l'absence<\/Label>\n\s*<Textarea\n\s*id="absence-reason"\n\s*value=\{absenceReason\}\n\s*onChange=\{\(e\) => setAbsenceReason\(e\.target\.value\)\}\n\s*placeholder="Indiquez le motif de l'absence\.\.\."\n\s*rows=\{2\}\n\s*\/>\n\s*<\/div>\n\s*\)\}/m,
  `<div className="space-y-2">
            <Label htmlFor="assignment-comment">Commentaire de l'affectation</Label>
            <Textarea
              id="assignment-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ex: Intervenir après 10h, Appeler le gardien..."
              rows={2}
            />
          </div>`
);


fs.writeFileSync(filepath, content, 'utf8');
console.log("Successfully rewrote EditAssignmentDialog.tsx");
