import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), 'google_sheets_templates');
if (!fs.existsSync(dir)) fs.mkdirSync(dir);

const sheets = {
  "Techniciens": ["ID", "Nom", "Couleur", "Interim", "Créé le"],
  "Commandes": ["ID", "Numéro", "Nom client", "Chantier", "Montant HT", "Achats", "Date", "Facture", "UUID"],
  "Chantiers": ["ID", "Nom", "Adresse", "Couleur", "Créé le"],
  "SAV": ["ID", "Numéro", "Nom du client", "Adresse", "Numéro de téléphone", "Problème", "Date", "Est résolu"],
  "Affectations": ["ID", "Equipe", "Chantier", "Date début", "Date fin", "Facturé", "Commentaire"],
  "Absences": ["ID", "Equipe", "Date début", "Date fin", "Motif", "Commentaire"],
  "Motifs": ["ID", "Nom", "Couleur", "Créé le"],
  "Notes": ["ID", "Technicien", "Date", "SAV", "Confirmé", "Facturé", "Texte"],
  "Factures": ["Numéro Facture", "Client", "Chantier", "Montant HT", "Achats", "Date"]
};

for (const [name, headers] of Object.entries(sheets)) {
  const content = headers.join(',') + '\n';
  fs.writeFileSync(path.join(dir, `${name}.csv`), content, 'utf8');
}

console.log('Valid CSVs generated successfully in google_sheets_templates/');
