/* Jeu exclusif SST « Secourir » : « Victime ! ». Une victime tirée au hasard (scénarios 1 à 999) :
   protéger, examiner dans l'ordre, choisir le résultat à atteindre, faire alerter, secourir, surveiller, transmettre.
   Tour par tour : chaque geste coûte du temps et l'état de la victime évolue.
   Conduites à tenir : guide des données techniques SST (INRS, V5 01/2024). */
import { ic, esc, fmt } from "../ui.js";
import { progress } from "../progress.js";
import { SND } from "./engine.js";
import { gameBar, bindBar } from "./common.js";

const COLOR = "#C1121F";
const M = "media/sst/";
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
const fmtT = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const wpick = (r, a) => { let x = r() * a.reduce((s, o) => s + (o.w || 1), 0); for (const o of a) if ((x -= o.w || 1) < 0) return o; return a[0]; };
const NUM = "le numéro prévu par l'entreprise, sinon le 15, le 18 ou le 112";
const SURV = "Je lui parle régulièrement, je la rassure, je la protège du froid ou de la chaleur ; si son état s'aggrave, je fais les gestes qui s'imposent et je rappelle les secours";

/* ---------- Lieux et dangers (Protéger) ---------- */
const LIEUX = {
  atelier: { t: "l'atelier de production", e: "🏭", dg: ["machine", "chariot"] },
  entrepot: { t: "l'entrepôt", e: "📦", dg: ["chariot"] },
  cuisine: { t: "la cuisine centrale", e: "🍳", dg: [] },
  pause: { t: "la salle de pause", e: "☕", dg: [] },
  chantier: { t: "le chantier", e: "🏗️", dg: ["machine"] },
  bureau: { t: "les bureaux", e: "🏢", dg: [] },
  labo: { t: "le laboratoire", e: "🧪", dg: [] },
  meca: { t: "l'atelier mécanique", e: "🔧", dg: ["machine"] },
  vestiaire: { t: "le vestiaire", e: "🚪", dg: [] },
  hall: { t: "le hall d'accueil", e: "🛎️", dg: [] }
};
const DANG = {
  aucun: { t: "Rien autour de la victime ne présente de danger persistant.", o: [
    ["La zone est sûre : je m'approche de la victime", 2, "Pas de danger persistant : on passe directement à l'examen."],
    ["Je fais un dégagement d'urgence pour l'éloigner", 0, "Le dégagement d'urgence est réservé à un danger réel, immédiat et non contrôlable. Ici, il n'y en a pas : tu risques d'aggraver son état.", { dmg: 8 }],
    ["Je fais baliser tout le secteur avant de m'approcher", 1, "Il n'y a rien à isoler : tu perds du temps.", { t: 30 }],
    ["J'attends les secours sans m'approcher", 0, "Sans danger, le SST s'approche et examine la victime.", { t: 40 }]] },
  machine: { t: "La machine juste à côté de la victime tourne encore.", o: [
    ["J'appuie sur l'arrêt d'urgence de la machine, puis je m'approche", 2, "**Supprimer** le danger, sans risque : c'est la solution à privilégier."],
    ["Je m'approche vite en faisant attention à la machine", 0, "Danger persistant : tu risques d'être la deuxième victime.", { crit: 1 }],
    ["Je tire la victime loin de la machine par les chevilles", 0, "On ne soustrait la victime que si on ne peut ni supprimer ni isoler le danger. Ici, l'arrêt d'urgence suffit.", { dmg: 8 }],
    ["Je balise la zone et j'attends qu'un technicien arrête la machine", 1, "Isoler, c'est moins bien que supprimer quand on peut supprimer sans risque : tu perds du temps.", { t: 40 }]] },
  chariot: { t: "Des chariots élévateurs circulent dans l'allée où la victime est allongée.", o: [
    ["Je fais arrêter la circulation et baliser l'allée, puis je m'approche", 2, "On ne peut pas supprimer ce danger : on l'**isole** (balisage, accès fermés), ou on le fait faire."],
    ["Je fonce vers la victime", 0, "Un chariot peut te renverser, toi et la victime.", { crit: 1 }],
    ["Je tire la victime hors de l'allée par les chevilles", 0, "Le dégagement d'urgence est réservé à un danger qu'on ne peut ni supprimer ni isoler. Ici, on peut isoler.", { dmg: 8 }],
    ["J'attends que les chariots aient fini leur tournée", 0, "La victime attend : on isole le danger et on agit.", { t: 60 }]] },
  courant: { t: "L'armoire électrique est toujours ouverte, et la victime est tout près des câbles.", o: [
    ["Je fais couper le courant au tableau (par une personne habilitée si besoin), sans toucher la victime avant", 2, "**Supprimer** le danger : couper l'alimentation, ou le faire faire par une personne habilitée."],
    ["J'écarte la victime en la tirant par ses vêtements", 0, "Si elle est encore sous tension, tu t'électrises à ton tour.", { crit: 1 }],
    ["J'écarte les câbles avec mon pied", 0, "Tu risques l'électrisation.", { crit: 1 }],
    ["J'éloigne les curieux et je m'approche de la victime", 0, "Le courant n'est pas coupé : danger pour toi et pour les autres.", { crit: 1 }]] },
  produit: { t: "Le produit renversé forme une flaque autour de la victime.", o: [
    ["J'enfile des gants et j'évite tout contact avec le produit", 2, "**Se protéger** pour éviter tout contact avec le produit chimique."],
    ["J'aide à mains nues, il faut faire vite", 0, "Tu risques d'être brûlé à ton tour.", { crit: 1 }],
    ["Je nettoie la flaque avant de m'occuper de la victime", 0, "La victime attend : on se protège et on agit.", { t: 60 }],
    ["Je fais un dégagement d'urgence", 0, "Le dégagement d'urgence est réservé à un danger réel, immédiat et non contrôlable.", { dmg: 6 }]] },
  flammes: { t: "La manche de la victime est en feu ! Elle panique et s'apprête à courir.", o: [
    ["Je l'empêche de courir, j'étouffe les flammes avec un vêtement ou une couverture, puis je la fais rouler au sol", 2, "Vêtements en feu : empêcher de courir, étouffer les flammes, rouler la victime au sol."],
    ["Je la laisse courir jusqu'au point d'eau", 0, "En courant, elle attise les flammes.", { crit: 1 }],
    ["Je pars chercher un extincteur", 0, "Pendant ce temps, elle brûle : on étouffe les flammes tout de suite.", { t: 40, dmg: 10 }],
    ["Je tape sur les flammes à mains nues", 0, "Tu vas te brûler les mains : étouffe avec un vêtement ou une couverture.", { dmg: 5 }]] }
};

/* ---------- Étapes communes ---------- */
function alertStep(V, mode, q) {
  const T = V.temoin;
  if (mode === "rcp") return T ? { q: V.Tn + " est à côté de toi. Que lui demandes-tu ?", o: [
      ["D'alerter les secours (" + NUM + ") et de m'apporter le défibrillateur", 2, "Dès l'arrêt de la respiration reconnu : faire alerter et réclamer un DAE.", { alert: 1 }],
      ["De m'aider à la mettre en PLS", 0, "Elle ne respire pas : la PLS la laisserait mourir.", { crit: 1 }],
      ["D'aller chercher un verre d'eau", 0, "Chaque minute sans alerte ni DAE réduit fortement ses chances.", { crit: 1 }],
      ["De prévenir sa famille", 0, "D'abord les secours et le DAE.", { t: 60 }]] }
    : { q: "Personne d'autre n'est là. Que fais-tu ?", o: [
      ["J'alerte immédiatement avec mon portable en haut-parleur, et je commence la RCP en attendant la réponse", 2, "Seul : alerter tout de suite, en haut-parleur, et débuter la RCP.", { alert: 1 }],
      ["Je commence la RCP et j'alerterai plus tard", 0, "Retarder l'alerte retarde le DAE et les secours.", { crit: 1 }],
      ["Je pars chercher de l'aide dans les autres ateliers", 0, "Pendant ce temps, personne ne masse. Avec un portable en haut-parleur, on alerte sans quitter la victime.", { t: 90, alert: 1 }],
      ["Je la mets en PLS, puis je vais alerter", 0, "Elle ne respire pas : la PLS est une erreur grave.", { crit: 1, t: 60, alert: 1 }]] };
  if (mode === "med") return { q: q || "Il faut un avis médical. Comment t'y prends-tu ?", o: [
      ["Je prends" + (T ? " (ou fais prendre par " + V.Tn + ")" : "") + " immédiatement un avis médical au 15, même si elle ne le veut pas ; je transmets ce que j'ai observé et entendu, et j'applique les consignes", 2, "L'avis médical est **immédiat** et ne doit pas être différé, **même à la demande de la victime**.", { alert: 1 }],
      ["Je respecte son choix : c'est à elle de décider", 0, "L'appel ne doit pas être différé, même à la demande de la victime.", { crit: 1 }],
      ["J'attends une heure pour voir si ça passe", 0, "Certains malaises s'aggravent très vite : avis médical immédiat.", { crit: 1 }],
      ["Je lui conseille de voir son médecin dans la semaine", 0, "Ce malaise impose un avis médical immédiat."]] };
  if (mode === "pls" && !T) return { q: "Personne d'autre n'est là. Comment alertes-tu ?", o: [
      ["Je pars alerter le plus vite possible, puis je reviens auprès d'elle", 2, "Seul et sans aide, après la PLS, le SST peut quitter la victime pour alerter, puis revient.", { alert: 1, t: 60 }],
      ["J'alerte avec mon portable, sans la quitter", 2, "Encore mieux si tu as un téléphone sur toi : tu restes auprès d'elle.", { alert: 1 }],
      ["J'attends qu'elle se réveille pour appeler", 0, "Une victime qui ne répond pas est une urgence.", { crit: 1 }],
      ["Je reste à côté d'elle sans alerter", 0, "Sans alerte, personne ne viendra.", { crit: 1 }]] };
  const self = mode === "sai" ? "Pendant qu'elle comprime, j'alerte moi-même (" + NUM + "), sans la quitter : portable en haut-parleur" : "J'alerte moi-même (" + NUM + "), en restant si possible auprès d'elle";
  return { q: q || "Et l'alerte ?", o: T ? [
      ["Je fais alerter par " + V.Tn + " (" + NUM + ") en lui demandant de revenir me rendre compte, et je reste auprès de la victime", 2, "Le SST fait alerter par la personne la plus apte, qui revient lui rendre compte.", { alert: 1 }],
      ["J'y vais moi-même et je laisse " + V.Tn + " avec la victime", 1, "Le SST reste auprès de la victime : il fait alerter par le témoin.", { alert: 1, t: 60 }],
      ["Personne : ça a l'air de bien se passer", 0, "Cette victime a besoin des secours."],
      ["Je demande à " + V.Tn + " d'appeler sa famille", 0, "D'abord les secours.", { t: 30 }]] : [
      [self, 2, "Pas de témoin : le SST alerte lui-même.", { alert: 1 }],
      ["Je n'alerte pas : ça a l'air de bien se passer", 0, "Cette victime a besoin des secours."],
      ["Je préviens son responsable par message, il verra", 0, "Ce sont les secours qu'il faut alerter, tout de suite.", { t: 30 }],
      ["Je finis tous mes gestes, et j'alerterai à la fin", 0, "Plus l'alerte est tardive, plus les secours arrivent tard."]] };
}
const STEP_INSTALL = { q: "Comment installes-tu la victime pour la RCP ?", all: { ctrl: 1 }, o: [
  ["Sur le dos, sur une surface rigide, poitrine dénudée si possible", 2, ""],
  ["Sur un canapé ou un matelas, pour son confort", 0, "Sur une surface molle, les compressions sont inefficaces.", { dmg: 8 }],
  ["En PLS", 0, "Elle ne respire pas : il faut la RCP.", { crit: 1 }],
  ["Assise contre le mur", 0, "La RCP se fait sur le dos, sur une surface rigide.", { crit: 1 }]] };
const STEP_MAINS = { q: "Où places-tu tes mains ?", img: M + "rcp-mains.webp", o: [
  ["Talon de la main au centre de la poitrine, sur la moitié inférieure du sternum, l'autre main par-dessus, doigts entrecroisés", 2, ""],
  ["Sur le côté gauche de la poitrine, sur le cœur", 0, "Au centre de la poitrine, jamais sur les côtes.", { dmg: 6 }],
  ["Sur le ventre", 0, "Au centre de la poitrine, moitié inférieure du sternum.", { dmg: 6 }],
  ["En haut du sternum, près du cou", 0, "Moitié inférieure du sternum.", { dmg: 6 }]] };
const STEP_RYTHME = { q: "Profondeur et rythme des compressions ?", o: [
  ["5 cm sans dépasser 6 cm, bras tendus, 100 à 120 par minute, en relâchant complètement", 2, ""],
  ["2 cm, 60 par minute, pour ne rien casser", 0, "Trop faible et trop lent : le sang ne circule pas.", { dmg: 8 }],
  ["Le plus fort possible, 200 par minute", 0, "5 à 6 cm, 100 à 120 par minute : au-delà, les compressions sont inefficaces.", { dmg: 6 }],
  ["5 cm, mais sans relâcher entre deux compressions", 0, "Relâcher complètement : le cœur doit se remplir.", { dmg: 6 }]] };
const STEP_ANALYSE = { q: "Le DAE annonce : « Analyse en cours, ne touchez pas la victime. »", o: [
  ["Je m'écarte et je m'assure que personne ne touche la victime", 2, ""],
  ["Je continue les compressions pendant l'analyse", 0, "Pendant l'analyse, personne ne touche la victime."],
  ["J'en profite pour lui tenir la main et lui parler", 0, "Pendant l'analyse, personne ne touche la victime."],
  ["J'éteins le DAE et je le rallume pour relancer l'analyse", 0, "On ne l'éteint jamais : on suit ses indications.", { crit: 1 }]] };
function stepsCycle(V, eto) {
  const S = [V.vomi
    ? { q: "Elle a vomi : tu ne peux pas pratiquer le bouche-à-bouche.", o: [
      ["Compressions thoraciques en continu, 100 à 120 par minute", 2, "Insufflations impossibles (vomissements, répulsion…) : compressions en continu."],
      ["J'arrête la RCP", 0, "Sans compressions, aucune chance.", { crit: 1 }],
      ["Je la mets en PLS", 0, "Elle ne respire pas : la RCP continue.", { crit: 1 }],
      ["J'attends que les secours la nettoient", 0, "La RCP ne s'interrompt pas.", { crit: 1 }]] }
    : { q: "Quel cycle réalises-tu chez cet adulte ?", img: M + "insufflation.webp", o: [
      ["30 compressions, puis 2 insufflations, les 2 en 5 secondes au plus", 2, ""],
      ["15 compressions, puis 2 insufflations", 0, "15/2, c'est pour l'enfant et le nourrisson. Adulte : 30/2."],
      ["5 insufflations, puis 30 compressions", 0, "Les 5 insufflations initiales, c'est pour l'enfant et le nourrisson."],
      ["30 compressions, puis 5 insufflations", 0, "Adulte : 30 compressions, 2 insufflations."]] }];
  if (eto) S.push({ q: "Elle s'était étouffée. Après chaque cycle de compressions, que fais-tu ?", o: [
    ["Je regarde dans sa bouche et je retire prudemment le corps étranger s'il est visible et accessible", 2, ""],
    ["Je fouille le fond de sa gorge avec les doigts", 0, "Tu risques d'enfoncer le corps étranger : on ne retire que ce qui est visible et accessible.", { dmg: 8 }],
    ["Je lui fais des claques dans le dos", 0, "Elle ne répond plus : RCP, et vérification de la bouche après chaque cycle."],
    ["Rien de particulier", 1, "Après chaque cycle de compressions, on regarde dans la bouche."]] });
  return S;
}
function stepDae(V, G) {
  const qui = G.daeHere ? "Tu as le DAE à côté de toi." : V.temoin ? V.Tn + " revient avec le DAE." : "Alerté par le bruit, un collègue arrive en courant avec le DAE.";
  return { q: qui + " Que fais-tu ?", img: M + "dae-electrodes.webp", all: { dae: 1 }, o: [
    ["Je le mets en marche et je suis ses indications : électrodes sur le thorax nu et sec, selon le schéma, en interrompant le moins possible les compressions", 2, ""],
    ["J'arrête tout pour lire la notice", 0, "Le DAE guide à la voix : on le met en marche et on suit ses indications.", { t: 60 }],
    ["Je le garde pour les secours, ils sauront s'en servir", 0, "Chaque minute compte : le DAE est mis en œuvre le plus tôt possible.", { crit: 1, t: 90 }],
    ["Je colle les électrodes sur son tee-shirt", 0, "Les électrodes se collent sur la peau nue et sèche.", { t: 30 }]] };
}
function stepDaeCas(V) {
  return {
    velu: { q: "Sa poitrine est très velue : les électrodes collent mal.", o: [
      ["Je rase rapidement l'endroit des électrodes, puis je les colle", 2, ""],
      ["Je les colle quand même par-dessus les poils", 0, "Mauvais contact : la peau doit être rasée si elle est très velue.", { t: 20 }],
      ["Je renonce au DAE", 0, "Le DAE reste la priorité : on rase et on colle.", { crit: 1 }],
      ["Je les colle sur son ventre, où il y a moins de poils", 0, "Les électrodes se placent selon le schéma.", { t: 20 }]] },
    timbre: { q: "Un timbre médicamenteux (patch) est collé là où doit aller une électrode.", o: [
      ["Je retire le timbre et j'essuie la peau, puis je colle l'électrode", 2, ""],
      ["Je colle l'électrode par-dessus le timbre", 0, "On retire le timbre et on essuie."],
      ["Je colle l'électrode ailleurs, sur le ventre", 0, "On garde l'emplacement du schéma : on retire le timbre."],
      ["Je renonce au DAE", 0, "Il suffit de retirer le timbre et d'essuyer.", { crit: 1 }]] },
    mouille: { q: "La victime est allongée sur un sol mouillé.", o: [
      ["Si possible, je la déplace sur une zone sèche : sinon l'efficacité est réduite, mais sans danger pour moi", 2, "Sol mouillé ou métallique : efficacité réduite, **pas de risque** pour le SST."],
      ["Je n'utilise pas le DAE, je risque l'électrocution", 0, "Il n'y a pas de risque pour le SST.", { crit: 1 }],
      ["J'éponge tout le sol avant de commencer", 0, "Pendant ce temps, personne ne masse.", { t: 90 }],
      ["Je mets des gants isolants avant de toucher le DAE", 1, "Inutile : il n'y a pas de risque pour le SST.", { t: 20 }]] },
    poitrine: { q: "Elle a une forte poitrine. Où colles-tu l'électrode de gauche ?", o: [
      ["Sous le sein gauche", 2, ""],
      ["Sur le sein", 0, "Forte poitrine : l'électrode gauche va sous le sein."],
      ["Au milieu du ventre", 0, "Sous le sein gauche."],
      ["Je ne mets qu'une seule électrode", 0, "Les deux électrodes sont indispensables.", { crit: 1 }]] },
    stim: { q: "Tu sens un boîtier sous la peau, sous sa clavicule droite, à l'endroit d'une électrode : un stimulateur cardiaque.", o: [
      ["Je colle l'électrode une largeur de main sous le boîtier", 2, ""],
      ["Je la colle directement sur le boîtier", 0, "Une largeur de main sous le boîtier."],
      ["Je renonce au DAE", 0, "Le DAE s'utilise : on décale simplement l'électrode.", { crit: 1 }],
      ["Je la colle sur le côté gauche, avec l'autre", 0, "On garde le schéma, en décalant sous le boîtier."]] }
  }[V.dcas] || null;
}
function stepsChoc(V) {
  if (!V.choc) return [{ q: "Le DAE annonce : « Choc non recommandé. Reprenez la RCP. »", o: [
    ["Je reprends immédiatement la RCP, DAE allumé et en place", 2, ""],
    ["J'éteins le DAE : il ne sert à rien", 0, "On ne l'éteint jamais : il doit pouvoir réanalyser.", { crit: 1 }],
    ["J'arrête la RCP : il n'y a plus rien à faire", 0, "La RCP continue jusqu'à l'arrivée des secours.", { crit: 1 }],
    ["Je déplace les électrodes et je relance l'analyse", 0, "On suit les indications du DAE.", { t: 20 }]] }];
  return [{ q: "Le DAE annonce : « Choc recommandé. Écartez-vous ! »", o: [
    ["J'annonce « Écartez-vous ! », je vérifie que personne ne touche la victime, puis le choc est délivré (j'appuie sur le bouton si le DAE le demande)", 2, "", { chocOK: 1 }],
    ["Je continue à masser pendant le choc", 0, "Personne ne touche la victime pendant le choc.", { crit: 1 }],
    ["Je lui tiens la main pour la rassurer", 0, "Personne ne touche la victime pendant le choc.", { crit: 1 }],
    ["Je retire les électrodes, c'est trop dangereux", 0, "On suit le DAE : « écartez-vous », puis choc.", { crit: 1 }]] },
  { q: "Le choc est délivré. Et maintenant ?", o: [
    ["Je reprends immédiatement la RCP, en suivant les indications du DAE", 2, ""],
    ["Je vérifie longuement si elle respire avant de reprendre", 0, "Reprise **immédiate** de la RCP après le choc.", { t: 30 }],
    ["J'attends que le DAE me dise quoi faire", 1, "Il le dira, mais la reprise doit être immédiate.", { t: 10 }],
    ["J'éteins le DAE : il a fait son travail", 0, "Jamais : il doit pouvoir réanalyser.", { crit: 1 }]] }];
}
function stepRcpFin(V, G) {
  if (V.choc && G.chocOK && V.rosc && G.vit > 40) return { pre: { rosc: 1 }, q: "Deux minutes plus tard, la victime bouge et se met à respirer normalement ! Que fais-tu du DAE ?", o: [
    ["Je le laisse allumé et en place, électrodes collées, et je surveille sa respiration en permanence jusqu'aux secours", 2, "Elle peut refaire un arrêt : le DAE doit pouvoir réanalyser immédiatement."],
    ["Je l'éteins, elle respire", 0, "En aucun cas on n'éteint le DAE, même si l'état s'améliore.", { crit: 1 }],
    ["Je retire les électrodes pour qu'elle soit plus à l'aise", 0, "On ne retire jamais les électrodes.", { crit: 1 }],
    ["Je le range dans son boîtier", 0, "Le DAE reste allumé et en place jusqu'aux secours.", { crit: 1 }]] };
  return V.temoin ? { q: "Les secours ne sont pas encore là et tu fatigues. " + V.Tn + " connaît les gestes.", o: [
    ["L'un comprime, l'autre insuffle, et on se relaie toutes les 2 minutes, pendant l'analyse du DAE", 2, "Deux sauveteurs : relais toutes les 2 minutes, pendant l'analyse."],
    ["Je continue seul jusqu'à l'épuisement", 1, "Des compressions fatiguées sont moins efficaces : relayez-vous.", { dmg: 5 }],
    ["On fait une pause de 5 minutes pour souffler", 0, "La RCP ne s'interrompt pas.", { crit: 1 }],
    ["On arrête : ça fait trop longtemps", 0, "La RCP continue jusqu'à l'arrivée des secours.", { crit: 1 }]] }
    : { q: "Les secours ne sont pas encore là et tu fatigues.", o: [
    ["Je continue la RCP en suivant le DAE jusqu'à l'arrivée des secours", 2, ""],
    ["Je m'arrête 5 minutes pour récupérer", 0, "La RCP ne s'interrompt pas.", { crit: 1 }],
    ["J'arrête : ça ne sert plus à rien", 0, "La RCP continue jusqu'à l'arrivée des secours.", { crit: 1 }],
    ["Je ralentis à 60 compressions par minute", 0, "100 à 120 par minute.", { dmg: 8 }]] };
}
/* Séquence RCP + DAE. sw = la victime vient de faire un arrêt (l'alerte est dans l'étape de bascule) */
function stepsRcp(V, sw, eto) {
  const S = [];
  if (!sw) S.push("ALERT:rcp");
  if (!V.temoin && !sw) S.push(V.daeNear
    ? { q: "Un DAE est accroché au mur, à quelques mètres : tu peux le prendre en moins de 10 secondes.", o: [
      ["Je vais le chercher tout de suite", 2, "Seul : on va chercher le DAE s'il est à **moins de 10 secondes**.", { daeHere: 1, t: 10 }],
      ["Je ne bouge pas : RCP sans DAE", 1, "À moins de 10 secondes, on va le chercher : le DAE augmente fortement les chances."],
      ["J'attends les secours pour le chercher", 0, "À moins de 10 secondes, on va le chercher tout de suite.", { t: 20 }],
      ["Je pars chercher aussi la trousse de secours", 0, "Seul le DAE compte ici : chaque seconde sans massage compte.", { t: 60, daeHere: 1 }]] }
    : { q: "Le DAE le plus proche est à l'autre bout du bâtiment.", o: [
      ["Je ne vais pas le chercher : je commence la RCP et je continue jusqu'à ce qu'on me l'apporte", 2, "Seul, on ne va chercher le DAE que s'il est à moins de 10 secondes."],
      ["Je cours le chercher", 0, "Trop loin : la victime resterait plus d'une minute sans massage.", { t: 90, daeHere: 1 }],
      ["J'appelle sa famille pour savoir s'il a des antécédents", 0, "La RCP d'abord.", { t: 60 }],
      ["J'attends les secours sans rien faire", 0, "Sans RCP, ses chances s'effondrent.", { crit: 1, t: 60 }]] });
  const fin = (G) => stepRcpFin(V, G), cas = () => stepDaeCas(V);
  S.push((G) => G.daeHere
    ? [STEP_INSTALL, (G2) => stepDae(V, G2), cas, STEP_ANALYSE, ...stepsChoc(V), STEP_MAINS, STEP_RYTHME, ...stepsCycle(V, eto), fin]
    : [STEP_INSTALL, STEP_MAINS, STEP_RYTHME, ...stepsCycle(V, eto), (G2) => stepDae(V, G2), cas, STEP_ANALYSE, ...stepsChoc(V), fin]);
  return S;
}
const bascule = (txt) => ({ q: txt + " Que fais-tu ?", o: [
  ["Je fais rappeler les secours et réclamer le DAE (ou je rappelle moi-même en haut-parleur), et je commence la RCP", 2, "Ne répond pas et ne respire pas : **arrêt cardiaque**. Alerte, DAE, RCP.", { sw: 1, alert: 1 }],
  ["Je la mets en PLS", 0, "Elle ne respire pas : la PLS est une erreur grave.", { crit: 1, sw: 1 }],
  ["J'attends les secours, ils sont en route", 0, "Sans RCP, ses chances s'effondrent.", { crit: 1, sw: 1, t: 60 }],
  ["J'ouvre la fenêtre pour lui donner de l'air", 0, "Elle ne respire pas : il faut la RCP, tout de suite.", { crit: 1, sw: 1, t: 30 }]] });

/* ---------- Les huit situations du guide, avec leurs variantes ---------- */
const CASES = {
  sai: { res: "Arrêter le saignement", fiche: "saigne", vital: [0.45, 0.02], w: 3,
    key: ["Faire **comprimer** par la victime, sinon comprimer soi-même **protégé** (gants, sac plastique).", "**Allonger**, **faire alerter**.", "Pansement compressif **seulement si la compression est efficace** ; sinon **garrot**.", "Cou, thorax, abdomen : **ni garrot, ni pansement compressif**."],
    subs: [
      { id: "membre", w: 3, at: ["atelier", "chantier", "cuisine", "meca", "entrepot"],
        v: (r, pick, V) => { const L = pick([["l'avant-bras", "le bras"], ["la main", "le bras"], ["la cuisse", "la jambe"], ["le mollet", "la jambe"]]); V.loc = L[0]; V.membre = L[1]; V.outil = pick(["un cutter", "une tôle coupante", "une disqueuse", "un couteau de cuisine", "le feuillard d'une palette"]); },
        intro: (V) => V.nom + " s'est profondément entaillé" + V.e + " " + V.loc + " avec " + V.outil + ". Le sang coule abondamment sur le sol.",
        ex: (V) => ({ s: "Oui : le sang coule abondamment de " + V.loc + " et forme une flaque. Il ne s'arrête pas.", r: "« J'ai mal, ça ne s'arrête pas ! »" }),
        steps: (V) => [
          { q: "Quelle est ta première action ?", o: [
            ["Je lui demande de comprimer immédiatement l'endroit qui saigne, avec un tissu propre si possible", 2, "La victime comprime elle-même : tu évites le contact avec le sang et tu restes disponible.", { ctrl: 1 }],
            ["Je cours chercher la trousse de secours", 0, "Pendant ce temps, le sang coule : on fait comprimer tout de suite.", { t: 40 }],
            ["Je pose immédiatement un garrot", 0, "Le garrot est réservé à une compression impossible ou inefficace.", { ctrl: 1, t: 30 }],
            ["Je lui fais lever " + V.membre + " et j'attends", 0, "Lever le membre n'arrête pas un saignement abondant : il faut comprimer.", { t: 20 }]] },
          { q: "Elle comprime, le sang ne coule plus. Et maintenant ?", o: [
            ["Je l'allonge", 2, "Allongée, la détresse circulatoire est retardée ou évitée."],
            ["Je l'accompagne à pied jusqu'à l'infirmerie", 0, "Debout, elle risque le malaise : on l'allonge sur place.", { crit: 1 }],
            ["Je la laisse debout, elle dit que ça va", 0, "Une victime qui a beaucoup saigné doit être allongée.", { dmg: 8 }],
            ["Je lui donne un verre d'eau", 0, "On l'allonge, et on maintient la compression."]] },
          "ALERT:sai"],
        comp: () => [[
          { pre: { unctrl: 1 }, q: "Elle pâlit et n'arrive plus à comprimer : le sang coule de nouveau. Tu dois comprimer toi-même. Comment te protèges-tu ?", o: [
            ["Gants à usage unique, ou à défaut un sac plastique, sans retarder la compression", 2, "On se protège du sang, sans retarder la compression.", { ctrl: 1 }],
            ["J'attends qu'on m'apporte des gants", 0, "Si on ne peut pas se protéger, on agit quand même, puis on se fait remplacer par une personne protégée.", { t: 40, ctrl: 1 }],
            ["Je ne comprime pas sans protection", 0, "Elle saigne abondamment : on comprime, protégé si possible.", { crit: 1, t: 60, ctrl: 1 }],
            ["Je comprime à mains nues, sans y penser", 1, "Le geste est juste, mais des maladies se transmettent par le sang : gants ou sac plastique si possible, puis protocole du médecin du travail.", { ctrl: 1 }]] },
          { q: "Tu comprimes. Elle a froid, elle transpire, ses lèvres sont très pâles. Que fais-tu ?", o: [
            ["Je maintiens la compression, je la couvre, et je fais rappeler les secours pour signaler l'aggravation", 2, "Sueurs, froid, pâleur intense : aggravation. On rappelle les secours."],
            ["Je la fais asseoir pour qu'elle reprenne ses esprits", 0, "Elle doit rester allongée.", { crit: 1 }],
            ["Je relâche pour voir si ça saigne encore", 0, "Le saignement reprendrait : la compression est maintenue jusqu'aux secours.", { dmg: 10 }],
            ["Je lui donne du sucre", 0, "Ce n'est pas un malaise : on maintient la compression et on rappelle les secours."]] }
        ], [
          { q: "Un autre collègue blessé t'appelle à l'aide plus loin. Tu dois libérer tes mains. Ta compression est efficace. Que fais-tu ?", o: [
            ["Je pose un pansement compressif : tissu propre sur la plaie, fixé par une bande ou un lien large bien serré", 2, "**Seulement** parce que la compression est efficace, le pansement compressif peut la remplacer."],
            ["Je pose un garrot pour être tranquille", 0, "Le garrot n'est posé que si la compression est impossible ou inefficace."],
            ["Je lâche tout, ça ne saigne plus", 0, "Le saignement reprendrait.", { dmg: 15 }],
            ["Je pose un pansement adhésif", 0, "Un pansement adhésif ne remplace pas une compression.", { dmg: 10 }]] },
          { pre: { unctrl: 1 }, q: "À ton retour, le sang traverse le pansement compressif. Que fais-tu ?", o: [
            ["Je comprime à nouveau par-dessus le pansement ; si le saignement continue, je pose un garrot", 2, "", { ctrl: 1 }],
            ["Je retire le pansement pour en mettre un autre", 0, "Le pansement compressif ne se retire jamais : on comprime par-dessus.", { dmg: 10, ctrl: 1 }],
            ["J'ajoute du coton par-dessus et je repars", 0, "Le saignement continue : compression par-dessus, puis garrot si besoin.", { dmg: 15, ctrl: 1, t: 30 }],
            ["Je lui demande de lever le membre blessé", 0, "Il faut comprimer par-dessus le pansement.", { t: 20, ctrl: 1 }]] }
        ]],
        bil: (V) => "Plaie de " + V.loc + " par " + V.outil + ", saignement abondant arrêté par compression, victime allongée, consciente." },
      { id: "cou", w: 1, at: ["atelier", "chantier", "meca"],
        intro: (V) => "Un éclat projeté par une meuleuse a entaillé le cou de " + V.nom + ". Le sang coule abondamment.",
        ex: () => ({ s: "Oui : le sang coule abondamment de la base du cou.", r: "« Mon cou… ça pisse le sang ! »" }),
        steps: () => [
          { q: "Quelle est ta première action ?", o: [
            ["Je lui demande de comprimer immédiatement l'endroit qui saigne, avec un tissu propre si possible", 2, "", { ctrl: 1 }],
            ["Je serre un bandage autour de son cou", 0, "Jamais de lien serré autour du cou.", { crit: 1 }],
            ["Je cours chercher la trousse de secours", 0, "On fait comprimer tout de suite.", { t: 40 }],
            ["Je lui fais pencher la tête en arrière", 0, "Il faut comprimer.", { t: 20 }]] },
          { q: "Elle comprime. Ensuite ?", o: [
            ["Je l'allonge", 2, ""],
            ["Je la fais asseoir sur une chaise", 0, "On l'allonge : cela retarde la détresse circulatoire.", { dmg: 6 }],
            ["Je l'emmène à l'infirmerie", 0, "On l'allonge sur place.", { crit: 1 }],
            ["Je lui donne à boire", 0, "On l'allonge."]] },
          "ALERT:sai",
          { q: "Peux-tu remplacer la compression par un pansement compressif ou un garrot ?", o: [
            ["Non : au cou, ni garrot ni pansement compressif. La compression manuelle est maintenue jusqu'aux secours", 2, ""],
            ["Oui, un pansement compressif bien serré autour du cou", 0, "Au cou, au thorax, à l'abdomen : ni garrot ni pansement compressif.", { crit: 1 }],
            ["Oui, un garrot", 0, "Jamais de garrot au cou.", { crit: 1 }],
            ["Je relâche de temps en temps pour la soulager", 0, "La compression est maintenue sans relâcher.", { dmg: 10 }]] }],
        bil: () => "Plaie du cou, saignement abondant contrôlé par compression manuelle maintenue, victime allongée, consciente." },
      { id: "verre", w: 1, at: ["atelier", "bureau", "labo", "entrepot"],
        v: (r, pick, V) => { V.loc = pick(["l'avant-bras", "la cuisse"]); },
        intro: (V) => V.nom + " a traversé une porte vitrée : un gros morceau de verre est planté dans " + V.loc + ". Le sang coule abondamment autour.",
        ex: (V) => ({ s: "Oui : le sang coule abondamment autour du verre planté dans " + V.loc + ".", r: "« Enlève-le ! Enlève-le ! »" }),
        steps: () => [
          { q: "Le verre est planté dans la plaie. Peux-tu comprimer ?", o: [
            ["Non, la compression est impossible : je pose un garrot quelques centimètres au-dessus de la plaie, entre le cœur et la plaie", 2, "Corps étranger : compression impossible, donc **garrot**. Un garrot de fabrication industrielle est préférable.", { ctrl: 1 }],
            ["Je retire le verre, puis je comprime", 0, "Ne jamais retirer un corps étranger : son retrait aggrave la lésion et le saignement.", { crit: 1, ctrl: 1 }],
            ["J'appuie fort directement sur le verre", 0, "Tu enfoncerais le verre.", { crit: 1 }],
            ["Je pose un pansement compressif par-dessus", 0, "Le pansement compressif remplace une compression efficace. Ici, la compression est impossible.", { t: 30 }]] },
          { q: "Pas de garrot du commerce. Comment l'improvises-tu ?", img: M + "garrot.webp", o: [
            ["Lien large non élastique (au moins 1,5 m, 3 à 5 cm de large), 5 à 7 cm au-dessus de la plaie, jamais sur une articulation : deux tours, un nœud, une barre, deux nœuds, je tourne jusqu'à l'arrêt du saignement", 2, ""],
            ["Un fil électrique fin, serré au maximum", 0, "Un lien fin coupe les tissus : il faut un lien large de 3 à 5 cm.", { dmg: 6 }],
            ["Un lien large, posé sur l'articulation la plus proche", 0, "Jamais sur une articulation.", { dmg: 6 }],
            ["Une ceinture élastique", 0, "Le lien doit être non élastique.", { dmg: 6 }]] },
          { q: "Ça ne saigne plus. Elle a très mal et te supplie de desserrer.", o: [
            ["Je maintiens le serrage et je laisse le garrot visible : il ne sera retiré que sur avis médical", 2, ""],
            ["Je desserre un peu pour la soulager", 0, "Le serrage est maintenu, même si la douleur est intense.", { dmg: 15 }],
            ["Je le cache sous une couverture pour qu'elle ne le voie pas", 0, "Le garrot doit rester visible pour les secours."],
            ["Je le retire au bout de 10 minutes", 0, "Jamais retiré sans avis médical.", { crit: 1 }]] },
          { q: "Comment l'installes-tu ?", o: [
            ["Allongée", 2, ""],
            ["Assise sur une chaise", 0, "On l'allonge : cela retarde la détresse circulatoire.", { dmg: 6 }],
            ["Debout, pour l'emmener vers la sortie", 0, "Elle reste allongée sur place.", { crit: 1 }],
            ["Comme elle veut", 1, "Une victime qui a beaucoup saigné doit être allongée."]] },
          "ALERT:sai"],
        bil: (V) => "Morceau de verre planté dans " + V.loc + ", saignement abondant, garrot posé à " + V.heure + ", victime allongée, consciente." },
      { id: "nez", w: 1, soft: 1, noAlert: 1, at: ["bureau", "atelier", "pause", "hall"],
        intro: (V) => V.nom + " saigne du nez depuis plusieurs minutes, sans avoir reçu de coup. Le mouchoir est déjà rouge.",
        ex: () => ({ s: "Le nez saigne et ne s'arrête pas, le mouchoir est imbibé.", r: "« Ça n'arrête pas de couler… »" }),
        steps: () => [
          { q: "Comment l'installes-tu ?", o: [
            ["Assise, la tête penchée en avant", 2, ""],
            ["Allongée sur le dos", 0, "Saignement de nez : **ne jamais allonger**, le sang coulerait dans la gorge."],
            ["Assise, la tête en arrière", 0, "Le sang coulerait dans la gorge : tête penchée en avant."],
            ["Debout, la tête en arrière", 0, "Assise, tête penchée en avant."]] },
          { q: "Et ensuite ?", o: [
            ["Je lui fais moucher vigoureusement, puis comprimer les narines 10 minutes sans relâcher", 2, ""],
            ["Je comprime 1 minute, puis je regarde si ça saigne encore", 0, "**10 minutes**, sans relâcher."],
            ["Je mets de la glace sur sa nuque", 0, "On fait moucher, puis comprimer les narines 10 minutes."],
            ["Je lui bouche le nez avec du coton bien tassé", 0, "On fait moucher, puis comprimer les narines 10 minutes."]] },
          { q: "Ça s'est arrêté. Elle te dit qu'elle prend un traitement qui fluidifie le sang. Que fais-tu ?", o: [
            ["Je lui conseille de prendre un avis médical : son traitement augmente les saignements", 2, "Avis médical si ça ne s'arrête pas, si ça se reproduit, après un coup, ou avec un traitement qui augmente les saignements."],
            ["Rien, c'est arrêté", 0, "Avec ce traitement, un avis médical est nécessaire."],
            ["Je lui dis d'arrêter son traitement", 0, "Jamais : seul le médecin décide."],
            ["Je lui donne de l'aspirine pour la douleur", 0, "L'aspirine augmente les saignements."]] }],
        comp: () => [[{ q: "Après 10 minutes, ça saigne encore. Que fais-tu ?", o: [
          ["Je prends un avis médical, et j'applique les consignes", 2, "Un saignement de nez qui ne s'arrête pas impose un avis médical.", { alert: 1 }],
          ["J'attends encore une heure", 0, "Ça ne s'arrête pas : avis médical.", { t: 60 }],
          ["Je l'allonge pour qu'elle se repose", 0, "Jamais allonger : assise, tête penchée en avant."],
          ["Je la renvoie chez elle", 0, "Avis médical d'abord."]] }]],
        bil: () => "Saignement de nez qui ne s'arrête pas après 10 minutes de compression, victime sous traitement fluidifiant, assise tête penchée en avant." }
    ] },
  eto: { res: "Lui permettre de respirer", fiche: "etouffe", vital: [0.7, 0], w: 2,
    key: ["Obstruction **complète** : ni parole, ni toux, ni son.", "**1 à 5 claques** dans le dos, puis **1 à 5 compressions**, en alternance.", "Femme enceinte, personne obèse : compressions **thoraciques**.", "Obstruction **partielle** : ne rien faire qui mobilise le corps étranger, **encourager à tousser**."],
    subs: [
      { id: "complete", w: 3, at: ["pause", "cuisine", "bureau"],
        v: (r, pick, V) => { V.morpho = V.f && r() < 0.2 ? "enceinte" : r() < 0.2 ? "obese" : ""; V.pdc = r() < 0.3; },
        intro: (V) => "Pendant la pause déjeuner, " + V.nom + (V.morpho === "enceinte" ? ", enceinte de 6 mois," : "") + " se lève brutalement et porte les mains à sa gorge, la bouche ouverte. Aucun son ne sort." + (V.morpho === "obese" ? " C'est une personne très corpulente : impossible d'encercler son abdomen." : ""),
        ex: () => ({ e: "complete" }),
        steps: (V) => {
          const thor = !!V.morpho;
          return [
            { q: "Elle ne peut ni parler, ni tousser, ni émettre un son. Quel est ton premier geste ?", o: [
              ["Sur le côté et légèrement en arrière, je soutiens son thorax, je la penche en avant et je donne 1 à 5 claques vigoureuses entre les omoplates, avec le talon de la main ouverte", 2, "", { chance: 0.35 }],
              ["Des compressions tout de suite", 0, "On commence par 1 à 5 claques dans le dos.", { t: 10 }],
              ["Je lui donne à boire pour faire passer", 0, "Rien ne passe : c'est inutile et dangereux.", { crit: 1 }],
              ["Je mets mes doigts dans sa bouche pour attraper l'aliment", 0, "Tu risques d'enfoncer le corps étranger.", { crit: 1 }]] },
            (G) => G.ok ? null : { q: "Les claques n'ont rien donné. Et maintenant ?", img: thor ? null : M + "heimlich-point.webp", o: thor ? [
              ["Compressions thoraciques : derrière elle, poing au milieu du sternum, l'autre main dessus, je tire vers l'arrière, 1 à 5 fois", 2, "Femme enceinte ou personne obèse : compressions **thoraciques**.", { chance: 0.6 }],
              ["Compressions abdominales, poing juste au-dessus du nombril", 0, "Femme enceinte ou personne obèse : compressions **thoraciques**, pas abdominales.", { t: 10 }],
              ["D'autres claques, sans m'arrêter", 0, "Après 1 à 5 claques inefficaces : 1 à 5 compressions.", { t: 15 }],
              ["Je l'allonge par terre", 0, "Elle est consciente : on reste debout, penchée en avant.", { t: 15 }]] : [
              ["Derrière elle, penchée en avant : poing fermé juste au-dessus du nombril, l'autre main dessus, je tire franchement vers l'arrière et vers le haut, 1 à 5 fois", 2, "", { chance: 0.6 }],
              ["Poing au milieu du sternum, je tire vers l'arrière", 0, "Les compressions thoraciques, c'est pour la femme enceinte ou la personne obèse. Ici : abdominales.", { t: 10 }],
              ["D'autres claques, sans m'arrêter", 0, "Après 1 à 5 claques inefficaces : 1 à 5 compressions.", { t: 15 }],
              ["Je l'allonge par terre", 0, "Elle est consciente : on reste debout, penchée en avant.", { t: 15 }]] },
            (G) => G.ok ? null : { q: "Toujours rien. Ses lèvres bleuissent. Que fais-tu ?", o: [
              ["J'alterne : à nouveau 1 à 5 claques, puis 1 à 5 compressions, et ainsi de suite", 2, "", { chance: V.pdc ? 0 : 1 }],
              ["J'arrête : ça ne marche pas", 0, "On alterne claques et compressions jusqu'à la désobstruction.", { crit: 1, chance: V.pdc ? 0 : 1, t: 20 }],
              ["J'attends les secours", 0, "Elle n'a pas ces minutes-là.", { crit: 1, chance: V.pdc ? 0 : 1, t: 30 }],
              ["Je la fais sauter sur place", 0, "On alterne claques et compressions.", { chance: V.pdc ? 0 : 1, t: 20 }]] },
            (G) => G.ok ? null : bascule("Elle perd connaissance et s'effondre dans tes bras. Elle ne répond plus et, voies aériennes libérées, ne respire pas."),
            (G) => G.ok && G.kind === "eto" ? { q: "Elle tousse fort et rejette un morceau de viande. Et maintenant ?", o: [
              ["J'arrête les manœuvres, je l'installe dans la position où elle se sent le mieux, je desserre ses vêtements, je lui parle et je la rassure", 2, ""],
              ["Je continue les compressions, par sécurité", 0, "Dès la désobstruction (rejet, toux, reprise de la respiration) : arrêter les manœuvres.", { dmg: 6 }],
              ["Je la mets en PLS", 0, "Elle est consciente : position où elle se sent le mieux."],
              ["Je la renvoie finir son repas", 0, "Elle doit être surveillée, et les secours alertés."]] } : null,
            "ALERT:std"];
        },
        bil: (V) => "Étouffement par un morceau de viande, obstruction complète levée par claques et compressions" + (V.morpho ? " thoraciques" : "") + ", victime consciente, installée en position de confort." },
      { id: "partielle", w: 1, ctrl0: 1, at: ["pause", "cuisine", "bureau", "hall"],
        intro: (V) => V.nom + " a avalé de travers : " + V.il + " tousse violemment, le visage rouge, une main sur la poitrine.",
        ex: () => ({ e: "partial", r: "« J'ai… avalé… de travers ! » (entre deux quintes de toux)" }),
        steps: () => [
          { q: "Elle tousse fort et parle. Que fais-tu ?", o: [
            ["Je ne fais rien qui pourrait déplacer le corps étranger : je l'installe dans la position où elle se sent le mieux et je l'encourage à tousser", 2, "Obstruction **partielle** : on encourage à tousser, sans claques ni compressions."],
            ["Des claques dans le dos pour l'aider", 0, "Obstruction partielle : les claques peuvent provoquer une obstruction complète.", { crit: 1 }],
            ["Des compressions abdominales", 0, "Obstruction partielle : les compressions peuvent provoquer une obstruction complète.", { crit: 1 }],
            ["Je lui donne à boire pour faire passer", 0, "On l'encourage à tousser, c'est tout."]] },
          "ALERT:std"],
        cp: 0.6,
        comp: () => [[{ pre: { unctrl: 1 }, q: "Sa toux devient faible et inefficace, elle s'épuise et ne peut plus parler. Que fais-tu ?", o: [
          ["J'applique la conduite de l'obstruction complète : 1 à 5 claques dans le dos, puis 1 à 5 compressions", 2, "Toux inefficace et victime qui se fatigue : conduite de l'obstruction **complète**.", { ctrl: 1, log: "Après trois claques, elle rejette un bonbon et respire de nouveau." }],
          ["Je continue à l'encourager à tousser", 0, "La toux ne suffit plus : claques, puis compressions.", { crit: 1, ctrl: 1, t: 40 }],
          ["Je l'allonge", 0, "Elle est consciente : penchée en avant, claques dans le dos.", { t: 30, ctrl: 1 }],
          ["Je lui donne à boire", 0, "Claques, puis compressions.", { t: 30, ctrl: 1 }]] }]],
        bil: () => "Fausse route, obstruction partielle avec toux efficace, victime consciente en position de confort." }
    ] },
  mal: { res: "Éviter l'aggravation et prendre un avis médical", fiche: "malaise", w: 3,
    key: ["Mettre **au repos**, dans la position où la victime se sent le mieux.", "**Questionner sans influencer** : âge, première fois, douleur, durée, maladie, traitement.", "**Avis médical immédiat**, même si la victime ne veut pas.", "Signes d'**AVC** ou douleur dans la poitrine, **même brefs** : urgence."],
    subs: [
      { id: "coeur", w: 2, age: [45, 62], at: ["atelier", "bureau", "entrepot", "hall"],
        intro: (V) => V.nom + ", " + V.age + " ans, s'assoit, pâle et en sueur. " + V.Il + " dit sentir « un étau » dans la poitrine depuis 10 minutes.",
        ex: () => ({ r: "« J'ai une douleur dans la poitrine… ça serre… »" }),
        steps: (V) => [
          { q: "Comment l'installes-tu ?", o: [
            ["Au repos, dans la position où elle se sent le mieux, vêtements desserrés", 2, ""],
            ["Je la fais marcher un peu pour voir si ça passe", 0, "Tout effort aggrave un accident cardiaque : repos.", { crit: 1 }],
            ["En PLS", 0, "Elle répond : pas de PLS."],
            ["Debout, appuyée contre le mur", 0, "Au repos, dans la position où elle se sent le mieux."]] },
          { q: "Que lui demandes-tu ?", o: [
            ["Son âge, si c'est la première fois, le type de douleur et où, depuis quand, si elle a été malade ou hospitalisée, si elle a un traitement", 2, ""],
            ["« C'est le cœur, hein ? Ça serre comme un étau, c'est ça ? »", 0, "On questionne **sans influencer** les réponses."],
            ["Rien, pour ne pas la fatiguer", 0, "Ses réponses sont essentielles pour le médecin."],
            ["Ce qu'elle a mangé ce midi", 0, "Âge, première fois, douleur, durée, maladies, traitement."]] },
          alertStep(V, "med", "Elle insiste : « Ne dérangez personne, ça va passer. » Que fais-tu ?"),
          { q: "Elle te demande de l'aider à prendre le médicament que son médecin lui a prescrit pour ces douleurs.", o: [
            ["Je l'aide à le prendre, en respectant la dose prescrite (ou selon la consigne du médecin)", 2, "Si la victime le demande, on l'aide à prendre son traitement prescrit, aux doses prescrites."],
            ["Je refuse : un SST ne donne jamais de médicament", 0, "Le SST aide la victime à prendre **son** traitement, si elle le demande."],
            ["Je lui en donne le double, pour que ça agisse plus vite", 0, "Jamais plus que la dose prescrite.", { crit: 1 }],
            ["Je lui donne un de mes médicaments", 0, "Uniquement son traitement prescrit.", { crit: 1 }]] }],
        cp: 0.3,
        comp: () => [[bascule("Soudain, elle s'effondre. Elle ne répond plus et, voies aériennes libérées, ne respire plus.")]],
        bil: (V) => (V.f ? "Femme" : "Homme") + " de " + V.age + " ans, douleur dans la poitrine en étau depuis 10 minutes, pâle, en sueur, au repos, a pris son traitement prescrit." },
      { id: "avc", w: 2, age: [40, 62], at: ["bureau", "hall", "atelier"],
        intro: (V) => "En pleine réunion, " + V.nom + " parle soudain de façon incohérente. Le coin de sa bouche tombe, et " + V.il + " n'arrive plus à lever le bras droit.",
        ex: () => ({ r: "« Je… ne trouve plus… mes mots… »" }),
        steps: (V) => [
          { q: "Ces signes, apparus brutalement, peuvent faire penser à…", o: [
            ["Un accident vasculaire cérébral (AVC)", 2, "Bras, visage, parole, vision, équilibre, mal de tête sévère : signes d'**AVC**."],
            ["Une crise d'angoisse", 0, "Paralysie d'un bras, bouche déformée, parole troublée : signes d'AVC."],
            ["Un coup de fatigue", 0, "Signes d'AVC : urgence."],
            ["Une hypoglycémie, à coup sûr", 0, "Ces signes doivent faire penser à un AVC."]] },
          { q: "Comment l'installes-tu ?", o: [
            ["Au repos, dans la position où elle se sent le mieux, vêtements desserrés, et je la rassure", 2, ""],
            ["Je la fais marcher pour voir si son bras revient", 0, "Repos.", { dmg: 6 }],
            ["En PLS", 0, "Elle répond : pas de PLS."],
            ["Je lui donne un café pour la réveiller", 0, "Repos, rien à boire."]] },
          alertStep(V, "med")],
        cp: 0.7,
        comp: () => [[{ q: "Au bout de deux minutes, tout est rentré dans l'ordre. Elle se sent bien et veut reprendre la réunion.", o: [
          ["Je maintiens l'avis médical : même de très courte durée, ces signes imposent une prise en charge urgente", 2, "Des signes d'AVC qui disparaissent peuvent annoncer un AVC grave."],
          ["Je fais annuler les secours", 0, "Même brefs, ces signes imposent une prise en charge urgente.", { crit: 1 }],
          ["Je lui conseille de voir son médecin la semaine prochaine", 0, "C'est une urgence, même si tout a disparu.", { crit: 1 }],
          ["Je lui donne du sucre", 0, "Signes d'AVC : avis médical immédiat, rien d'autre."]] }]],
        bil: (V) => "Apparition brutale : difficulté de parole, bouche déformée, bras droit paralysé, à surveiller : signes d'AVC." },
      { id: "chaleur", w: 1, at: ["chantier", "atelier", "entrepot"],
        intro: (V) => "En plein été, sous une chaleur écrasante, " + V.nom + " se plaint d'un violent mal de tête et de nausées. Sa peau est brûlante.",
        ex: () => ({ r: "« J'ai trop chaud… la tête qui tourne… »" }),
        steps: (V) => [
          { q: "Où l'installes-tu ?", o: [
            ["Dans un endroit frais et aéré, au repos", 2, ""],
            ["Au soleil, allongée par terre", 0, "Malaise dû à la chaleur : endroit frais et aéré."],
            ["Elle continue à travailler en buvant beaucoup", 0, "Elle doit être mise au repos, au frais.", { crit: 1 }],
            ["Dans sa voiture fermée", 0, "Endroit frais et aéré.", { crit: 1 }]] },
          { q: "Comment la rafraîchis-tu ?", o: [
            ["Je la déshabille ou desserre ses vêtements, et je la rafraîchis : linges mouillés, brumisateur, ventilateur, glace entourée d'un linge au cou, aux aisselles, à l'aine", 2, ""],
            ["De la glace directement sur la peau", 0, "La glace s'entoure toujours d'un linge."],
            ["Je la couvre pour qu'elle transpire", 0, "Il faut rafraîchir, pas réchauffer.", { crit: 1 }],
            ["Je lui donne un café bien sucré", 0, "Il faut la rafraîchir."]] },
          { q: "Elle est consciente, peut avaler, et a soif.", o: [
            ["Je lui donne de l'eau fraîche, par petites quantités", 2, ""],
            ["Une grande bouteille d'eau glacée, d'un trait", 0, "Par petites quantités."],
            ["Rien du tout", 1, "Consciente et capable d'avaler : eau fraîche, par petites quantités."],
            ["Une boisson énergisante", 0, "De l'eau fraîche, par petites quantités."]] },
          alertStep(V, "med")],
        bil: () => "Malaise dû à la chaleur : maux de tête, nausées, peau brûlante. Mise au frais, rafraîchie, a bu un peu d'eau." },
      { id: "sucre", w: 1, at: ["bureau", "atelier", "entrepot", "pause"],
        intro: (V) => V.nom + ", diabétique, transpire et tremble. " + V.Il + " paraît confus" + V.e + " et réclame du sucre.",
        ex: () => ({ r: "« Vite… du sucre… je suis diabétique… »" }),
        steps: (V) => [
          { q: "Elle te réclame du sucre. Que fais-tu ?", o: [
            ["Je lui en donne, en morceaux si possible", 2, "Si la victime demande du sucre, on lui en donne, en morceaux si possible."],
            ["Je refuse : un SST ne donne rien à manger", 0, "Si elle demande du sucre, on lui en donne."],
            ["Je lui fais son injection d'insuline", 0, "Jamais : l'insuline ferait encore baisser son sucre.", { crit: 1 }],
            ["Je prends un médicament dans la trousse", 0, "Du sucre, comme elle le demande."]] },
          { q: "Comment l'installes-tu ?", o: [
            ["Au repos, dans la position où elle se sent le mieux", 2, ""],
            ["Je la fais marcher pour qu'elle se remette", 0, "Repos.", { dmg: 6 }],
            ["En PLS", 0, "Elle répond : pas de PLS."],
            ["Je la laisse retourner à son poste", 0, "Repos, et avis médical.", { dmg: 6 }]] },
          alertStep(V, "med")],
        bil: () => "Diabétique, sueurs, tremblements, confusion : a reçu du sucre à sa demande, au repos." },
      { id: "vagal", w: 1, at: ["atelier", "bureau", "hall"],
        intro: (V) => "Debout à son poste, " + V.nom + " annonce qu'" + V.il + " va « tourner de l'œil » : étourdissements, nausées, sueurs, points noirs devant les yeux.",
        ex: () => ({ r: "« Je vais tomber dans les pommes… »" }),
        steps: (V) => [
          { q: "Que fais-tu ?", o: [
            ["Je l'allonge tout de suite ; en attendant, elle peut croiser les jambes en les contractant", 2, "Les manœuvres physiques (croiser les jambes en contractant, s'accroupir tête entre les genoux) aident, mais **ne remplacent pas la position allongée**."],
            ["Je la fais marcher pour s'aérer", 0, "Elle risque de chuter : on l'allonge.", { crit: 1 }],
            ["Je la tiens debout par le bras", 0, "On l'allonge."],
            ["Je lui donne un café", 0, "On l'allonge."]] },
          { q: "Que lui demandes-tu ?", o: [
            ["Son âge, si c'est la première fois, ce qu'elle ressent, depuis quand, ses maladies et son traitement", 2, ""],
            ["« C'est le cœur, vous croyez ? »", 0, "On questionne sans influencer."],
            ["Rien", 0, "Ses réponses guideront le médecin."],
            ["Si elle a bien dormi, et c'est tout", 0, "Âge, première fois, ressenti, durée, maladies, traitement."]] },
          alertStep(V, "med")],
        bil: () => "Malaise annoncé : étourdissements, nausées, sueurs, points noirs. Allongée, consciente." }
    ] },
  bru: { res: "Éviter l'aggravation de la brûlure", fiche: "brulures", w: 2,
    key: ["**Eau courante tempérée**, faible pression, **10 à 20 minutes**.", "Bijoux et vêtements retirés, **sauf ce qui colle**.", "Cloque **> ½ paume**, visage, mains, chimique, électrique : **grave**, alerter dès le début de l'arrosage.", "Chimique : rincer **15 minutes au moins**. Jamais de produit, jamais percer les cloques."],
    subs: [
      { id: "grave", w: 2, at: ["cuisine", "atelier", "meca"],
        v: (r, pick, V) => { V.cause = pick(["en sortant une plaque brûlante du four", "avec de l'huile bouillante", "sur une pièce qui sortait du four de traitement"]); },
        intro: (V) => V.nom + " s'est brûlé" + V.e + " l'avant-bras " + V.cause + ". Une cloque se forme, plus large que la moitié de sa paume.",
        ex: () => ({ r: "« Ça brûle ! Ça brûle ! »" }),
        steps: () => [
          { q: "Que fais-tu en premier ?", o: [
            ["Je refroidis immédiatement sous l'eau courante tempérée, à faible pression", 2, ""],
            ["De la glace directement sur la brûlure", 0, "Eau courante tempérée, faible pression."],
            ["De la crème ou de la pommade", 0, "Aucun produit sans avis médical."],
            ["Je perce la cloque pour soulager", 0, "Ne jamais percer les cloques.", { crit: 1 }]] },
          { q: "Est-ce une brûlure grave ?", o: [
            ["Oui : la cloque est plus large que la moitié de sa paume. Je fais alerter dès le début de l'arrosage", 2, "Cloque **supérieure à la moitié de la paume** : brûlure **grave**.", { alert: 1 }],
            ["Non : une cloque, c'est toujours simple", 0, "Plus large que la moitié de la paume : grave.", { t: 60 }],
            ["Non : ce n'est que le bras", 0, "C'est la taille de la cloque qui compte ici : grave.", { t: 60 }],
            ["Je verrai à la fin de l'arrosage", 0, "Brûlure grave : alerter **dès le début** de l'arrosage.", { t: 600 }]] },
          { q: "Combien de temps arroses-tu ?", t: 600, o: [
            ["Au moins 10 minutes, idéalement 20", 2, ""],
            ["30 secondes", 0, "Au moins 10 minutes."],
            ["Une heure, à l'eau glacée", 0, "Trop froid et trop long, l'arrosage refroidit dangereusement le corps.", { dmg: 8 }],
            ["Jusqu'à ce que la peau devienne blanche", 0, "Au moins 10 minutes, idéalement 20."]] },
          { q: "Elle porte une montre et une bague de ce côté. Sa manche colle à la brûlure.", o: [
            ["Je retire montre, bague et vêtements près de la brûlure, sauf ce qui colle à la peau", 2, ""],
            ["Je laisse tout en place", 0, "Bijoux et vêtements se retirent : le membre va gonfler."],
            ["Je retire tout, y compris la manche qui colle", 0, "On n'ôte jamais ce qui adhère à la peau.", { crit: 1 }],
            ["Je retire seulement la manche collée", 0, "Bijoux oui, ce qui colle non.", { crit: 1 }]] },
          { q: "En attendant les secours, comment l'installes-tu ?", o: [
            ["Allongée sur une partie non brûlée (assise si elle respire mal), brûlure laissée visible si possible", 2, ""],
            ["Debout, pour qu'elle marche jusqu'aux secours", 0, "Brûlure grave : allongée."],
            ["Allongée sur le bras brûlé", 0, "Sur une région non atteinte."],
            ["Brûlure emballée serrée dans du coton", 0, "On laisse la brûlure visible."]] }],
        bil: (V) => "Brûlure de l'avant-bras " + V.cause + ", cloque plus large que la moitié de la paume, arrosée 20 minutes, bijoux retirés." },
      { id: "simple", w: 1, noAlert: 1, at: ["cuisine", "pause", "bureau"],
        intro: (V) => V.nom + " s'est brûlé" + V.e + " l'avant-bras sur une casserole. La peau est rouge, avec une petite cloque grosse comme un ongle.",
        ex: () => ({ r: "« Aïe… ça pique ! »" }),
        steps: () => [
          { q: "Que fais-tu en premier ?", o: [
            ["Je refroidis immédiatement sous l'eau courante tempérée, à faible pression", 2, ""],
            ["Du beurre ou de l'huile sur la brûlure", 0, "Aucun produit sans avis médical."],
            ["De la glace directement dessus", 0, "Eau courante tempérée."],
            ["Je perce la cloque", 0, "Ne jamais percer les cloques."]] },
          { q: "Simple ou grave ?", o: [
            ["Simple : rougeur et petite cloque, bien moins que la moitié de sa paume, sur l'avant-bras", 2, ""],
            ["Grave : il y a une cloque", 0, "Une cloque **plus petite que la moitié de la paume** : simple (hors visage, cou, mains, articulations)."],
            ["Grave : toute brûlure est grave", 0, "Rougeur ou petite cloque : simple."],
            ["Impossible à dire", 0, "Taille de la cloque, aspect, localisation, origine : ici, simple."]] },
          { q: "Elle n'a plus mal. Et ensuite ?", t: 600, o: [
            ["Je protège la brûlure avec un pansement stérile ou un film plastique non adhésif (type film alimentaire)", 2, ""],
            ["Du coton directement sur la brûlure", 0, "Le coton colle à la peau : pansement stérile ou film plastique."],
            ["Une pommade grasse", 0, "Aucun produit sans avis médical."],
            ["Je perce la cloque et je mets un pansement", 0, "Ne jamais percer les cloques."]] },
          { q: "Quel conseil lui donnes-tu ?", o: [
            ["Prendre un avis médical pour vérifier sa vaccination antitétanique, ou si fièvre, rougeur, chaleur ou gonflement apparaissent", 2, ""],
            ["Aucun : c'est fini", 0, "Vaccination antitétanique, et signes d'infection à surveiller."],
            ["Percer la cloque ce soir si elle gonfle", 0, "Jamais."],
            ["Mettre de la crème solaire dessus demain", 0, "Aucun produit sans avis médical."]] }] },
      { id: "chimique", w: 2, dgf: "produit", at: ["labo", "atelier"],
        v: (r, pick, V) => { V.oeil = r() < 0.5; V.prod = pick(["acide", "basique (soude)", "décapant"]); },
        intro: (V) => "Un bidon de produit " + V.prod + " se renverse : " + V.nom + " reçoit une projection sur la jambe" + (V.oeil ? " et dans l'œil gauche" : "") + ".",
        ex: (V) => ({ r: V.oeil ? "« Ça me brûle la jambe ! Et mon œil ! »" : "« Ça me brûle la jambe ! »" }),
        steps: (V) => [
          { q: "Pour la jambe, que fais-tu ?", o: [
            ["Je la fais rincer immédiatement à l'eau courante tempérée, faible pression, au moins 15 minutes, en retirant sous l'eau les vêtements imbibés et les chaussures", 2, "Les vêtements imbibés **et les chaussures** se retirent **sous l'eau**."],
            ["J'essuie avec un chiffon", 0, "Rinçage immédiat et abondant, au moins 15 minutes.", { dmg: 10 }],
            ["Je neutralise avec un autre produit", 0, "Jamais : on rince à l'eau.", { crit: 1 }],
            ["Je rince une minute", 0, "Au moins 15 minutes.", { dmg: 10 }]] },
          ...(V.oeil ? [{ q: "Et l'œil ?", o: [
            ["Je le fais rincer au moins 15 minutes sans que l'eau coule dans l'autre œil, lentilles retirées, rince-œil si disponible", 2, ""],
            ["Je lui dis de frotter pour enlever le produit", 0, "On rince, on ne frotte pas.", { dmg: 10 }],
            ["Un collyre", 0, "On rince au moins 15 minutes.", { dmg: 10 }],
            ["Je rince les deux yeux en même temps, tête droite", 0, "L'eau ne doit pas couler dans l'autre œil.", { dmg: 8 }]] }] : []),
          "ALERT:std",
          { q: "Que transmets-tu aux secours sur le produit ?", o: [
            ["Le nom du produit, et je garde son emballage ou sa fiche de données de sécurité", 2, "Conserver les infos du produit (FDS, rubrique 4 « Premiers secours ») et le nommer en alertant."],
            ["Rien de particulier", 0, "Le nom du produit oriente le traitement."],
            ["La couleur du bidon", 0, "Le nom du produit, et sa fiche de données de sécurité."],
            ["Je jette le bidon pour éviter un autre accident", 0, "On garde l'emballage pour les secours."]] }],
        bil: (V) => "Projection de produit " + V.prod + " sur la jambe" + (V.oeil ? " et l'œil gauche" : "") + ", rinçage de 15 minutes en cours, vêtements et chaussures retirés. Fiche de données de sécurité disponible." },
      { id: "elec", w: 1, dgf: "courant", at: ["atelier", "meca", "chantier"],
        intro: (V) => V.nom + " a touché une armoire électrique ouverte et a été projeté" + V.e + " en arrière. Une petite brûlure noirâtre marque sa main.",
        ex: () => ({ r: "« J'ai pris une décharge… ma main… »" }),
        steps: () => [
          { q: "La brûlure est petite. Est-elle grave ?", o: [
            ["Oui : une brûlure d'origine électrique est toujours grave. J'arrose la zone visible et je fais alerter", 2, "Origine électrique : **grave**, même si elle paraît petite.", { alert: 1 }],
            ["Non, un pansement suffit", 0, "Les lésions internes peuvent être graves : alerte.", { crit: 1 }],
            ["Non, on n'arrose pas une brûlure électrique", 0, "On arrose la zone brûlée visible.", { t: 30 }],
            ["De la pommade et elle reprend son poste", 0, "Brûlure électrique : grave.", { crit: 1 }]] },
          { q: "Que fais-tu ensuite ?", o: [
            ["J'applique les consignes du médecin, et je la surveille", 2, ""],
            ["Je la laisse reprendre son travail", 0, "Elle doit être surveillée jusqu'aux secours.", { crit: 1 }],
            ["Je la raccompagne chez elle", 0, "Elle attend les secours, sous surveillance.", { crit: 1 }],
            ["Je lui donne un antidouleur", 0, "Seulement sur consigne du médecin."]] }],
        cp: 0.25,
        comp: () => [[bascule("Elle s'effondre brutalement. Elle ne répond plus et, voies aériennes libérées, ne respire plus.")]],
        bil: () => "Électrisation sur une armoire électrique, projetée en arrière, petite brûlure noirâtre à la main, courant coupé." },
      { id: "feu", w: 1, dgf: "flammes", at: ["atelier", "meca", "chantier"],
        intro: (V) => "La manche de " + V.nom + " prend feu au contact d'un chalumeau.",
        ex: () => ({ r: "« Mon bras ! Ça brûle ! »" }),
        steps: () => [
          { q: "Les flammes sont éteintes. Le bras est couvert de cloques. Que fais-tu ?", o: [
            ["Je refroidis immédiatement sous l'eau courante tempérée, à faible pression, et je fais alerter dès le début de l'arrosage : brûlure grave", 2, "Cloques étendues : **grave**.", { alert: 1 }],
            ["De la glace et de la crème", 0, "Eau courante tempérée, aucun produit.", { dmg: 8 }],
            ["J'attends de voir l'étendue des dégâts", 0, "On refroidit tout de suite.", { t: 120 }],
            ["Je perce les cloques", 0, "Jamais.", { crit: 1 }]] },
          { q: "Des morceaux de tissu brûlé collent à la peau.", t: 600, o: [
            ["Je retire les vêtements et bijoux autour, sans ôter ce qui colle à la peau, et je poursuis l'arrosage 10 à 20 minutes", 2, ""],
            ["J'arrache les morceaux collés", 0, "Jamais ce qui adhère à la peau.", { crit: 1 }],
            ["J'arrête l'arrosage pour couper la manche", 0, "L'arrosage se poursuit.", { dmg: 6 }],
            ["J'arrose une heure à l'eau glacée", 0, "Trop froid et trop long : risque de refroidir dangereusement le corps.", { dmg: 8 }]] }],
        bil: () => "Vêtements en feu au chalumeau, flammes étouffées, brûlure étendue du bras avec cloques, arrosée, tissu collé laissé en place." }
    ] },
  dou: { res: "Éviter l'aggravation du traumatisme supposé", fiche: "douleur", w: 2,
    key: ["Douleur du cou après un traumatisme : **ne pas bouger la tête**.", "**Faire alerter**, puis **maintenir la tête à deux mains**, dans sa position.", "Membre : **ne pas mobiliser** ; fracture déplacée : **jamais réaligner**.", "Coup sur la tête avec vomissements ou propos incohérents : **allonger**, alerter."],
    subs: [
      { id: "cou", w: 2, at: ["chantier", "entrepot", "atelier"],
        v: (r, pick, V) => { V.chute = pick(["d'un échafaudage roulant", "d'un escabeau", "du quai de chargement"]); },
        intro: (V) => V.nom + " a chuté " + V.chute + ". Allongé" + V.e + " sur le dos, " + V.il + " se plaint d'une vive douleur au cou et essaie de se relever.",
        ex: () => ({ r: "« J'ai super mal au cou… »" }),
        steps: () => [
          { q: "Que lui dis-tu en premier ?", o: [
            ["De ne pas bouger la tête, et je la préviens de ce que je vais faire", 2, ""],
            ["De se relever doucement", 0, "Suspicion de traumatisme du cou : ne pas bouger.", { crit: 1 }],
            ["De tourner la tête pour voir si ça fait mal", 0, "Ne pas bouger la tête.", { crit: 1 }],
            ["Je lui glisse un coussin sous la tête", 0, "On ne bouge pas la tête.", { dmg: 8 }]] },
          "ALERT:std",
          { q: "Comment maintiens-tu sa tête ?", o: [
            ["À genoux ou en trépied dans l'axe, mes deux mains de chaque côté de sa tête, dans la position où elle se trouve", 2, ""],
            ["Je remets sa tête bien droite d'abord", 0, "On maintient la tête **dans la position où elle se trouve**.", { crit: 1 }],
            ["Une main sous la nuque, je la soulève un peu", 0, "Deux mains de chaque côté de la tête, sans la bouger.", { dmg: 8 }],
            ["Je lui tiens le menton", 0, "Deux mains de chaque côté de la tête.", { dmg: 6 }]] },
          { q: "Les minutes passent, tes bras fatiguent.", o: [
            ["Je prends appui avec mes coudes au sol ou sur mes genoux", 2, ""],
            ["Je lâche de temps en temps pour me reposer", 0, "Le maintien est continu.", { dmg: 6 }],
            ["Je lui demande de tenir sa tête elle-même", 0, "Elle ne doit pas bouger.", { dmg: 6 }],
            ["Je cale sa tête avec mes chaussures et je m'en vais", 0, "On maintient à deux mains, et on surveille.", { dmg: 8 }]] }],
        cp: 0.3,
        comp: () => [[{ q: "Elle ne répond plus, mais elle respire.", o: [
          ["Je la laisse sur le dos, je maintiens la bascule de la tête pour libérer ses voies aériennes, je fais rappeler les secours et je surveille sa respiration", 2, "Traumatisme : **sur le dos**, liberté des voies aériennes maintenue."],
          ["Je la mets en PLS", 0, "Après un traumatisme, on la laisse sur le dos.", { crit: 1 }],
          ["Je la relève pour la réveiller", 0, "Jamais.", { crit: 1 }],
          ["Je commence la RCP", 0, "Elle respire : pas de RCP."]] }]],
        bil: (V) => "Chute " + V.chute + ", douleur vive du cou, tête maintenue à deux mains depuis la chute." },
      { id: "membre", w: 1, at: ["chantier", "entrepot", "atelier", "hall"],
        intro: (V) => V.nom + " a glissé dans l'escalier. Sa jambe forme un angle anormal sous le genou, et " + V.il + " hurle de douleur.",
        ex: () => ({ r: "« Ma jambe ! Ne me touchez pas ! »" }),
        steps: () => [
          { q: "Sa jambe est visiblement déformée. Que fais-tu ?", o: [
            ["Je lui demande de ne pas bouger la jambe", 2, ""],
            ["Je la remets dans l'axe pour la soulager", 0, "Fracture déplacée : **jamais réaligner**.", { crit: 1 }],
            ["Je l'aide à se relever pour tester", 0, "On ne mobilise pas la partie atteinte.", { crit: 1 }],
            ["Je masse la zone", 0, "On ne mobilise pas la partie atteinte.", { dmg: 8 }]] },
          "ALERT:std",
          { q: "Et en attendant ?", o: [
            ["Je respecte les recommandations des secours, et je la surveille", 2, ""],
            ["Je l'emmène moi-même aux urgences en voiture", 0, "On attend les secours, sans la mobiliser.", { crit: 1 }],
            ["Je lui donne un antidouleur de la trousse", 0, "Seulement sur consigne du médecin."],
            ["Je fabrique une attelle et je redresse la jambe", 0, "Jamais réaligner.", { crit: 1 }]] }],
        bil: () => "Chute dans l'escalier, déformation de la jambe sous le genou, non mobilisée, consciente, très douloureuse." },
      { id: "tete", w: 1, at: ["chantier", "entrepot", "meca"],
        intro: (V) => V.nom + " s'est cogné" + V.e + " violemment la tête contre une poutre. Quelques minutes plus tard, " + V.il + " vomit et répète les mêmes questions.",
        ex: () => ({ r: "« Qu'est-ce qui s'est passé ? … Qu'est-ce qui s'est passé ? »" }),
        steps: () => [
          { q: "Que fais-tu ?", o: [
            ["Je l'allonge", 2, "Coup sur la tête avec vomissements ou propos incohérents : **allonger**, alerter, surveiller."],
            ["Je la fais asseoir avec un verre d'eau", 0, "On l'allonge."],
            ["Je la renvoie chez elle se reposer", 0, "Ces signes sont graves : alerte.", { crit: 1 }],
            ["Je lui donne un antidouleur pour sa tête", 0, "On l'allonge, on alerte."]] },
          "ALERT:std"],
        bil: () => "Coup violent sur la tête contre une poutre, vomissements, répète les mêmes questions, allongée." }
    ] },
  pla: { res: "Éviter l'aggravation de la plaie", fiche: "plaie", w: 2,
    key: ["Corps étranger : **ne jamais le retirer**.", "Thorax : **assise**, plaie à l'air. Abdomen : **à plat dos, jambes fléchies**. Œil : allongée, **deux yeux fermés**.", "Segment sectionné : linge propre, **double sac**, eau et glaçons, jamais de contact direct.", "Plaie simple : se laver les mains, eau et savon, **vaccination antitétanique**."],
    subs: [
      { id: "ventre", w: 1, at: ["atelier", "meca", "chantier"],
        intro: (V) => "Un éclat de métal s'est planté dans le ventre de " + V.nom + " pendant le meulage. Il dépasse de la plaie, qui saigne peu.",
        ex: () => ({ r: "« J'ai un truc planté dans le ventre… enlève-le ! »" }),
        steps: () => [
          { q: "Elle te demande d'enlever l'éclat.", o: [
            ["Je ne le retire jamais", 2, "Son retrait ou sa mobilisation peut aggraver la lésion et le saignement."],
            ["Je le retire doucement", 0, "Ne jamais retirer un corps étranger.", { crit: 1 }],
            ["Je le retire d'un coup sec", 0, "Ne jamais retirer un corps étranger.", { crit: 1 }],
            ["Je l'enfonce pour qu'il ne dépasse plus", 0, "On n'y touche pas.", { crit: 1 }]] },
          { q: "Comment l'installes-tu ?", o: [
            ["Allongée à plat dos, jambes fléchies (calées si possible)", 2, "Plaie de l'abdomen : à plat dos, jambes fléchies."],
            ["Assise", 0, "Assise, c'est pour une plaie du thorax."],
            ["Sur le ventre", 0, "Jamais sur le ventre.", { crit: 1 }],
            ["Debout, appuyée au mur", 0, "À plat dos, jambes fléchies."]] },
          "ALERT:std"],
        bil: () => "Éclat de métal planté dans l'abdomen, laissé en place, saigne peu, allongée jambes fléchies." },
      { id: "thorax", w: 1, at: ["atelier", "meca"],
        intro: (V) => "Une tige métallique éjectée par une presse a blessé " + V.nom + " à la poitrine. La plaie saigne peu, mais " + V.il + " respire difficilement.",
        ex: () => ({ r: "« J'ai du mal… à respirer… »" }),
        steps: () => [
          { q: "Comment l'installes-tu ?", o: [
            ["Assise, la plaie laissée à l'air libre", 2, "Plaie du thorax : **assise**, plaie à l'air libre, la respiration est plus facile."],
            ["Allongée à plat dos, jambes fléchies", 0, "C'est pour une plaie de l'abdomen."],
            ["Je ferme la plaie avec un pansement serré", 0, "La plaie reste à l'air libre."],
            ["En PLS", 0, "Elle répond : assise."]] },
          "ALERT:std"],
        bil: () => "Plaie de la poitrine par une tige éjectée, gêne respiratoire, installée assise, plaie à l'air libre." },
      { id: "oeil", w: 1, at: ["meca", "atelier", "chantier"],
        intro: (V) => "Un copeau de métal a jailli dans l'œil droit de " + V.nom + " pendant un perçage. L'œil saigne un peu.",
        ex: () => ({ r: "« Mon œil ! J'ai un truc dans l'œil ! »" }),
        steps: () => [
          { q: "Que fais-tu ?", o: [
            ["Je l'allonge à plat dos, je lui demande de fermer les deux yeux et de ne pas bouger la tête", 2, "Plaie de l'œil : **allongée**, **les deux yeux fermés** (ils bougent ensemble)."],
            ["Je retire le copeau avec le coin d'un mouchoir", 0, "Corps étranger : on ne le retire jamais.", { crit: 1 }],
            ["Je rince l'œil longuement", 0, "Le rinçage, c'est pour un produit chimique."],
            ["Je couvre l'œil blessé, elle garde l'autre ouvert", 0, "Les deux yeux fermés : sinon l'œil blessé bouge avec l'autre."]] },
          { q: "Et sa tête ?", o: [
            ["Si possible, je la maintiens à deux mains", 2, ""],
            ["Je la tourne sur le côté", 0, "On ne bouge pas la tête."],
            ["Je lui mets un coussin pour la relever", 0, "On ne bouge pas la tête."],
            ["Elle peut bouger, aucun problème", 0, "Elle ne doit pas bouger la tête."]] },
          "ALERT:std"],
        bil: () => "Copeau de métal dans l'œil droit, non retiré, allongée, les deux yeux fermés, tête maintenue." },
      { id: "doigt", w: 1, at: ["atelier", "cuisine", "meca"],
        v: (r, pick, V) => { V.mach = pick(["une presse", "une trancheuse", "une scie à ruban"]); },
        intro: (V) => "Le bout de l'index de " + V.nom + " a été sectionné par " + V.mach + ". Le moignon saigne un peu.",
        ex: () => ({ s: "Le moignon saigne, mais pas abondamment.", r: "« Mon doigt ! Mon doigt ! »" }),
        steps: (V) => [
          { q: "Que fais-tu d'abord ?", o: [
            ["Je l'allonge", 2, ""],
            ["Je cherche le bout de doigt avant tout", 0, "D'abord la victime : on l'allonge, on alerte.", { t: 60 }],
            ["Je la fais asseoir sur une chaise", 0, "On l'allonge."],
            ["Je l'emmène à l'infirmerie", 0, "On l'allonge sur place."]] },
          "ALERT:std",
          { q: "Et le moignon ?", o: [
            ["Je le protège avec un tissu propre, et je comprime si ça saigne", 2, ""],
            ["Je le désinfecte à l'alcool", 0, "On le protège, on comprime si besoin."],
            ["Je le laisse à l'air", 0, "On protège le moignon."],
            ["Je pose un garrot au poignet", 0, "Le saignement est faible : on protège, on comprime si besoin."]] },
          { q: "Tu retrouves le bout de doigt près de " + V.mach + ". Que fais-tu ?", o: [
            ["Dans un linge propre, puis un sac fermé, lui-même placé dans un second sac avec de l'eau et des glaçons, confié aux secours", 2, "Aucun contact direct avec l'eau ou la glace, **quel que soit son état**."],
            ["Directement dans la glace", 0, "Jamais de contact direct avec la glace."],
            ["Je le jette : il est trop abîmé", 0, "On le récupère, **quel que soit son état**.", { crit: 1 }],
            ["Dans un verre d'eau", 0, "Linge propre, double sac, eau et glaçons."]] }],
        bil: (V) => "Bout de l'index sectionné par " + V.mach + ", moignon protégé, segment conditionné en double sac avec eau et glaçons." },
      { id: "simple", w: 1, noAlert: 1, at: ["bureau", "atelier", "entrepot", "cuisine"],
        intro: (V) => V.nom + " s'est fait une petite coupure au doigt avec un cutter. Elle est peu profonde et saigne à peine.",
        ex: () => ({ s: "Non : quelques gouttes seulement.", r: "« C'est rien, juste une petite coupure. »" }),
        steps: () => [
          { q: "Par quoi commences-tu ?", o: [
            ["Je me lave les mains à l'eau et au savon, et je mets des gants si possible", 2, ""],
            ["Je nettoie la plaie tout de suite, mains nues", 0, "D'abord se laver les mains."],
            ["Je mets directement un pansement", 0, "On se lave les mains, puis on nettoie la plaie."],
            ["Je souffle sur la plaie", 0, "On se lave les mains, puis on nettoie."]] },
          { q: "Comment nettoies-tu la plaie ?", o: [
            ["À l'eau courante et au savon, puis je rince et je sèche", 2, ""],
            ["Avec de l'alcool pur", 0, "Eau et savon, puis antiseptique selon les consignes du médecin du travail."],
            ["Je ne la nettoie pas", 0, "On nettoie à l'eau et au savon."],
            ["Avec un mouchoir déjà utilisé", 0, "Eau et savon, compresse propre si besoin."]] },
          { q: "Et ensuite ?", o: [
            ["Antiseptique selon les consignes du médecin du travail, puis un pansement adhésif sur peau bien sèche", 2, ""],
            ["Du coton collé sur la plaie", 0, "Pansement adhésif sur peau sèche."],
            ["Rien, ça va sécher", 0, "On désinfecte et on protège."],
            ["De la pommade de ma trousse personnelle", 0, "Antiseptique selon les consignes du médecin du travail."]] },
          { q: "Quel conseil lui donnes-tu ?", o: [
            ["Vérifier sa vaccination antitétanique, et consulter si fièvre, zone chaude, rouge, gonflée ou douloureuse", 2, ""],
            ["Aucun", 0, "Vaccination antitétanique et signes d'infection."],
            ["Retirer le pansement dans une heure", 0, "Vaccination antitétanique et signes d'infection."],
            ["Mettre du sel dessus ce soir", 0, "Non."]] }] }
    ] },
  pls: { res: "Lui permettre de continuer à respirer", fiche: "pls", vital: [0.2, 0.01], w: 2, noSurv: 1,
    key: ["Non traumatique : **PLS**. Traumatique ou origine inconnue : **sur le dos, bascule de la tête maintenue**.", "Seul : alerter, puis revenir.", "**Surveiller la respiration en permanence** ; si elle s'arrête : RCP.", "Femme enceinte ou personne obèse : sur le **côté gauche**."],
    subs: [
      { id: "malaise", w: 2, at: ["vestiaire", "bureau", "pause", "hall"],
        v: (r, pick, V) => { V.enc = V.f && r() < 0.25; },
        intro: (V) => (V.temoin ? V.Tn + " t'appelle : " + V.nom + (V.enc ? ", enceinte de 7 mois," : "") + " s'est senti" + V.e + " mal et s'est effondré" + V.e + " doucement, sans se cogner." : "Tu vois " + V.nom + (V.enc ? ", enceinte de 7 mois," : "") + " s'effondrer doucement le long du mur, sans se cogner.") + " " + V.Il + " est allongé" + V.e + " sur le dos.",
        ex: () => ({ b: "oui" }),
        steps: (V) => [
          { q: "Pas de chute ni de choc : l'événement n'est pas traumatique. Que fais-tu ?", o: [
            ["Je la mets en position latérale de sécurité (PLS)", 2, "Ne répond pas, respire, non traumatique : **PLS**, pour que les liquides s'écoulent et que la langue ne bascule pas.", { ctrl: 1 }],
            ["Je la laisse sur le dos sans rien faire", 0, "Sur le dos, la langue peut basculer et bloquer l'air.", { crit: 1 }],
            ["Je commence la RCP", 0, "Elle respire : pas de RCP.", { ctrl: 1, t: 30 }],
            ["Je l'assois contre le mur", 0, "PLS.", { t: 20 }]] },
          V.enc ? { q: "Elle est enceinte de 7 mois. De quel côté la tournes-tu ?", o: [
            ["Sur le côté gauche", 2, "Femme enceinte : PLS sur le **côté gauche**."],
            ["Sur le côté droit", 0, "Côté gauche."],
            ["Peu importe", 0, "Côté gauche."],
            ["Je la laisse sur le dos", 0, "PLS sur le côté gauche.", { crit: 1 }]] }
          : { q: "Pendant la PLS, comment gardes-tu sa tête dans l'axe ?", img: M + "pls.webp", o: [
            ["Le dos de sa main contre son oreille, paume contre paume avec la mienne, j'accompagne le mouvement de la tête", 2, ""],
            ["Je la tire par les cheveux", 0, "Le dos de sa main contre son oreille accompagne la tête."],
            ["Je ne m'occupe pas de la tête", 0, "La tête doit rester dans l'axe.", { dmg: 6 }],
            ["Je lui tiens fermement le menton", 0, "Le dos de sa main contre son oreille, paume contre paume."]] },
          "ALERT:pls",
          { q: "En attendant les secours, que surveilles-tu ?", o: [
            ["Sa respiration, en permanence : le ventre ou la poitrine qui se soulèvent, les bruits, ma main sur son thorax", 2, ""],
            ["Rien : elle est en PLS", 0, "La respiration peut s'arrêter : surveillance permanente.", { crit: 1 }],
            ["Sa température seulement", 0, "Sa respiration, en permanence."],
            ["L'heure d'arrivée des secours", 0, "Sa respiration, en permanence."]] }],
        cp: 0.35,
        comp: () => [[bascule("Sa respiration devient lente et bruyante, puis s'arrête.")]],
        bil: (V) => "Malaise sans traumatisme, ne répond pas, respire, en PLS" + (V.enc ? " sur le côté gauche (enceinte de 7 mois)" : "") + ", respiration surveillée en permanence." },
      { id: "trauma", w: 1, at: ["chantier", "entrepot", "atelier"],
        intro: (V) => V.nom + " est tombé" + V.e + " d'une échelle. " + V.Il + " est allongé" + V.e + " sur le dos, immobile.",
        ex: () => ({ b: "oui" }),
        steps: () => [
          { q: "C'est un traumatisme. Que fais-tu ?", o: [
            ["Je la laisse sur le dos et je maintiens la bascule de sa tête pour garder ses voies aériennes libres", 2, "Traumatique ou origine inconnue : **sur le dos**, bascule de la tête maintenue.", { ctrl: 1 }],
            ["Je la mets en PLS", 0, "Chez un traumatisé, la mobilisation peut aggraver une lésion de la colonne.", { crit: 1, ctrl: 1 }],
            ["Je la relève", 0, "Jamais.", { crit: 1 }],
            ["Je commence la RCP", 0, "Elle respire : pas de RCP.", { t: 30 }]] },
          "ALERT:std",
          { q: "En attendant, que surveilles-tu ?", o: [
            ["Sa respiration, en permanence", 2, ""],
            ["Rien de particulier", 0, "La respiration, en permanence.", { crit: 1 }],
            ["Ses chaussures", 0, "Sa respiration."],
            ["Son téléphone, au cas où sa famille appelle", 0, "Sa respiration."]] }],
        cp: 0.5,
        comp: () => [[{ q: "Elle se met à vomir.", o: [
          ["Je la mets sur le côté en gardant l'axe tête-cou-tronc", 2, "S'il vomit, un traumatisé se met sur le côté, axe tête-cou-tronc respecté."],
          ["Je la laisse sur le dos", 0, "Elle risque d'inhaler ses vomissements.", { crit: 1 }],
          ["Je la redresse en position assise", 0, "Sur le côté, en gardant l'axe.", { crit: 1 }],
          ["J'essuie sa bouche sans la bouger", 0, "Il faut la mettre sur le côté.", { dmg: 10 }]] }]],
        bil: () => "Chute d'une échelle, ne répond pas, respire, laissée sur le dos, voies aériennes maintenues libres." }
    ] },
  rcp: { res: "Assurer une respiration et une circulation artificielles", fiche: "rcp", vital: [0.5, 0.08], w: 3, noSurv: 1,
    key: ["**Faire alerter et réclamer le DAE** (seul : haut-parleur).", "Centre de la poitrine, **5 à 6 cm**, **100 à 120 par minute**, **30/2**.", "DAE : **suivre ses consignes**, « écartez-vous », reprise immédiate de la RCP.", "**Jamais éteindre le DAE ni retirer les électrodes.**"],
    subs: [
      { id: "arret", at: ["hall", "atelier", "bureau", "entrepot", "pause", "vestiaire"],
        v: (r, pick, V) => { V.gasp = r() < 0.4; V.daeNear = r() < 0.5; V.choc = r() < 0.7; V.rosc = r() < 0.65; V.vomi = r() < 0.2; V.dcas = r() < 0.5 ? pick(["velu", "timbre", "mouille", "stim"].concat(V.f ? ["poitrine"] : [])) : null; },
        intro: (V) => V.nom + " s'effondre brutalement dans " + V.lieu + ".",
        ex: (V) => ({ b: V.gasp ? "gasp" : "non" }),
        steps: (V) => stepsRcp(V),
        bil: (V) => "Effondrement brutal, ne répondait pas, ne respirait pas" + (V.gasp ? " (gasps)" : "") + ". RCP 30/2" + ", DAE posé" + (V.choc ? ", choc délivré" : ", pas de choc recommandé") + "." }
    ] }
};

/* ---------- Générateur de scénarios ---------- */
const PRENOMS = [["Karim", 0], ["Julie", 1], ["Thomas", 0], ["Sofia", 1], ["Mehdi", 0], ["Nathalie", 1], ["Lucas", 0], ["Inès", 1], ["Pascal", 0], ["Chloé", 1], ["Yannick", 0], ["Fatou", 1],
  ["Bruno", 0], ["Camille", 1], ["Hugo", 0], ["Aïcha", 1], ["Denis", 0], ["Laura", 1], ["Samir", 0], ["Martine", 1], ["Kevin", 0], ["Élodie", 1], ["Antoine", 0], ["Sarah", 1]];
const KINDS = Object.keys(CASES).map((k) => ({ k, w: CASES[k].w }));

export function scenario(n) {
  const r = rng(n * 7919 + 13), pick = (a) => a[Math.floor(r() * a.length)];
  const kind = wpick(r, KINDS).k, sub = wpick(r, CASES[kind].subs);
  const lieuId = pick(sub.at), L = LIEUX[lieuId];
  const [nom, f] = pick(PRENOMS);
  let [tn, tf] = pick(PRENOMS); if (tn === nom) [tn, tf] = PRENOMS[(PRENOMS.findIndex((p) => p[0] === nom) + 1) % PRENOMS.length];
  const age = sub.age ? sub.age[0] + Math.floor(r() * (sub.age[1] - sub.age[0])) : 22 + Math.floor(r() * 40);
  const V = { n, kind, sub, nom, f, e: f ? "e" : "", il: f ? "elle" : "il", Il: f ? "Elle" : "Il", age, lieu: L.t, em: L.e,
    temoin: r() < 0.6, Tn: tn, T: (tf ? "ta collègue " : "ton collègue ") + tn, eta: 360 + Math.floor(r() * 240), heure: (8 + Math.floor(r() * 9)) + " h " + String(Math.floor(r() * 12) * 5).padStart(2, "0") };
  V.danger = sub.dgf || (L.dg.length && r() < 0.4 ? pick(L.dg) : "aucun");
  if (sub.v) sub.v(r, pick, V);
  const comps = sub.comp ? sub.comp(V) : [];
  V.comp = comps.length && r() < (sub.cp || 0.6) ? pick(comps) : null;
  return V;
}

/* ---------- L'examen ---------- */
const EXQ = [["s", "Saigne-t-elle abondamment ?", 5], ["e", "S'étouffe-t-elle ?", 5], ["r", "Répond-elle ?", 5], ["b", "Respire-t-elle ?", 10]];
function exam(V) {
  const x = V.sub.ex(V), conscious = !!x.r || !!x.e, lva = "Tu libères ses voies aériennes (main sur le front, doigts sous le menton, bascule de la tête) et tu observes 10 secondes au plus : ";
  return {
    s: x.s || "Non : rien sur les vêtements ni au sol.",
    e: x.e === "complete" ? "« Est-ce que vous vous étouffez ? » Elle fait signe que oui : ni parole, ni toux, ni son. Bouche ouverte, elle s'agite." : x.e === "partial" ? "Elle tousse fort et parle avec difficulté, avec un bruit à chaque inspiration." : conscious ? "Non : elle parle et respire sans gêne." : "Rien n'indique un étouffement.",
    r: x.e === "complete" ? "Elle ne peut pas parler, mais elle te regarde, paniquée : elle est consciente." : x.r ? "Oui : " + x.r : "Aucune réponse. Tu secoues doucement ses épaules : « Serrez-moi la main ! Ouvrez les yeux ! » Aucune réaction.",
    b: x.e === "complete" ? "Aucun air ne passe : elle ne peut pas respirer." : conscious ? "Elle parle : elle respire." : x.b === "oui" ? lva + "le ventre et la poitrine se soulèvent, tu sens son souffle. Elle respire." : x.b === "gasp" ? lva + "une respiration lente, bruyante, avec de longues pauses (gasps)." : lva + "aucun mouvement, aucun bruit, aucun souffle. Elle ne respire pas.",
    vital: x.s && V.kind === "sai" ? "s" : x.e === "complete" ? "e" : null,
    need: x.s && V.kind === "sai" ? ["s"] : x.e === "complete" ? ["e"] : conscious ? ["s", "r"] : ["s", "r", "b"]
  };
}

/* ---------- Le jeu ---------- */
export function startVictimeGame(ctx) {
  const { app, mod } = ctx;
  let G = null;
  const $ = (s) => app.querySelector(s);
  document.documentElement.classList.add("noscroll");
  const cleanup = () => { closeModal(); document.documentElement.classList.remove("noscroll"); };
  const exit = () => { cleanup(); ctx.exit(); };
  const H = {};
  const bind = (root) => root.querySelectorAll("[data-a]").forEach((b) => { b.onclick = () => H[b.dataset.a](b.dataset.v); });

  function start(n) {
    const V = scenario(n || 1 + Math.floor(Math.random() * 999)), C = CASES[V.kind];
    G = { V, C, kind: V.kind, soft: !!V.sub.soft, ctrl: !!V.sub.ctrl0, vit: 100, t: 0, phase: "brief", log: [], good: [], errors: [], crit: 0, seen: {}, exq: shuffle(EXQ), X: exam(V), alertT: null };
    closeModal(); brief();
  }
  function rate() {
    const R = !G.soft && !G.rosc && CASES[G.kind].vital;
    return R ? (G.kind === "rcp" && G.ctrl && G.dae ? 0.05 : R[G.ctrl ? 1 : 0]) : 0;
  }
  function pass(sec) { G.vit -= rate() * sec; G.t += sec; }
  function etat() {
    if (G.phase === "brief" || G.phase === "proteger" || G.phase === "examen") return ["?", "#9aa1ab"];
    if (G.kind === "rcp" && !G.rosc) return ["Arrêt cardiaque", "var(--red)"];
    return G.vit >= 75 ? ["Stable", "var(--ok)"] : G.vit >= 45 ? ["S'aggrave", "#E07800"] : ["Critique", "var(--red)"];
  }
  function hudHTML() {
    if (!G || G.phase === "fin") return "";
    const [et, col] = etat(), sec = G.alertT == null ? "non alertés" : "~ " + Math.max(0, Math.ceil((G.alertT + G.V.eta - G.t) / 60)) + " min";
    return '<div><span>Victime</span><b style="color:' + col + '">' + et + '</b></div><div><span>Temps</span><b>' + fmtT(G.t) + "</b></div><div><span>Secours</span><b>" + sec + "</b></div>";
  }
  function frame(inner) {
    app.innerHTML = '<div class="screen mdy">' + gameBar({ badge: "Victime !", color: COLOR, label: G ? "Scénario n° " + G.V.n : mod.title }) +
      '<div class="mdy-hud" style="grid-template-columns:repeat(3,1fr)">' + hudHTML() + '</div><div class="mdy-main">' + inner + "</div></div>";
    bindBar(app, () => (G && G.phase !== "brief" && G.phase !== "fin" ? modal("Quitter ?", "<p>La partie en cours sera perdue.</p>", [["Quitter", exit, "red"], ["Continuer", null]]) : exit()));
    bind(app);
    const m = $(".mdy-main"); if (m) m.scrollTop = 0;
  }
  const logm = (t) => G.log.push("[" + fmtT(G.t) + "] " + t);
  const logHTML = () => (G.log.length ? '<div class="mdy-log">' + G.log.slice(-8).reverse().map((x) => "<div>" + esc(x) + "</div>").join("") + "</div>" : "");

  /* ----- 1. Briefing ----- */
  function brief() {
    const V = G.V;
    frame('<div class="mdy-scene" style="display:grid;place-items:center;font-size:84px">' + V.em + "<span>Scénario n° " + V.n + "</span></div><h1>Victime !</h1>" +
      '<div class="mdy-card"><p>' + esc(V.sub.intro(V)) + "</p><p>Tu es SST, dans " + esc(V.lieu) + ". " + (V.temoin ? esc(V.T.charAt(0).toUpperCase() + V.T.slice(1)) + " est avec toi." : "Personne d'autre n'est présent.") + "</p></div>" +
      "<p>Réagis comme un SST : <b>protéger, examiner, faire alerter, secourir, surveiller</b>.</p>" +
      '<details class="rsv-rules"><summary>' + ic("help") + " Comment jouer</summary><ul>" +
        "<li>Chaque décision prend du <b>temps</b>. Une erreur en fait perdre davantage.</li>" +
        "<li>Si la victime est en <b>détresse vitale</b>, son état se dégrade à chaque seconde, tant que tu n'as pas fait le bon geste.</li>" +
        "<li><b>Examiner</b> : pose tes questions dans le bon ordre. Dès que tu trouves une détresse, agis.</li>" +
        "<li>Plusieurs réponses peuvent être justes. Des <b>imprévus</b> peuvent arriver.</li></ul></details>" +
      '<div class="row" style="margin-top:14px"><button class="btn big red" data-a="proteger">' + ic("play") + 'C\'est parti</button><button class="btn big" data-a="other">' + ic("reset") + "Autre victime</button></div>" +
      '<form class="rsv-plan" id="vnum"><label>Jouer un scénario précis (n° 1 à 999) : <input id="vn" type="number" min="1" max="999" inputmode="numeric" value="' + V.n + '"></label><button class="btn">OK</button></form>');
    $("#vnum").onsubmit = (e) => { e.preventDefault(); start(Math.max(1, Math.min(999, parseInt($("#vn").value, 10) || 1))); };
  }
  H.other = () => start();
  /* ----- 2. Protéger ----- */
  H.proteger = () => {
    G.phase = "proteger";
    const D = DANG[G.V.danger];
    ask({ q: D.t + " Que fais-tu ?", o: D.o }, "① Protéger", () => examen());
  };
  /* ----- 3. Examiner ----- */
  function examen() {
    G.phase = "examen";
    const X = G.X;
    frame('<h2 class="mdy-h">② Examiner</h2><p>Pose tes questions dans l\'ordre de l\'urgence vitale. Dès que tu as trouvé ce qui menace la victime, passe à l\'action.</p>' +
      G.exq.map(([k, q]) => '<button class="mdy-choice' + (G.seen[k] ? " seen" : "") + '" data-a="ex" data-v="' + k + '"><b>' + q + "</b>" + (G.seen[k] ? "<span>" + esc(X[k]) + "</span>" : "") + "</button>").join("") +
      '<div class="row" style="margin-top:12px"><button class="btn big red" data-a="agir">' + ic("play") + "J'ai trouvé : j'agis</button></div>" + logHTML());
  }
  H.ex = (k) => {
    if (G.seen[k]) return;
    const X = G.X, ord = EXQ.map((e) => e[0]), i = ord.indexOf(k);
    if (X.vital && G.seen[X.vital] && !G.errDetresse) { G.errDetresse = 1; G.errors.push("Détresse vitale trouvée, mais l'examen a continué : une détresse = une action, tout de suite."); logm("✖ Tu perds du temps : la détresse est trouvée, il faut agir."); }
    else if (ord.slice(0, i).some((x) => !G.seen[x]) && !G.errOrdre && !(X.vital && k === X.vital)) { G.errOrdre = 1; G.errors.push("Examen dans le désordre : saigne-t-elle ? s'étouffe-t-elle ? répond-elle ? respire-t-elle ?"); logm("≈ Ordre de l'examen : saigne ? s'étouffe ? répond ? respire ?"); }
    G.seen[k] = 1; pass(EXQ[i][2]);
    if (G.vit <= 0) return end();
    examen();
  };
  H.agir = () => {
    const X = G.X, miss = X.need.filter((k) => !G.seen[k]);
    if (miss.length) { G.errors.push("Action engagée sans avoir examiné : " + miss.map((k) => "« " + EXQ.find((e) => e[0] === k)[1] + " »").join(", ") + "."); }
    const others = shuffle(Object.keys(CASES).filter((k) => k !== G.kind && CASES[k].res !== G.C.res)).slice(0, 3).map((k) => CASES[k].res);
    G.phase = "resultat";
    ask({ q: "Quel est le résultat à atteindre ?", o: [[G.C.res, 2, "Une détresse = une action : le **résultat à atteindre** détermine le geste."]].concat(others.map((o) => [o, 0, "Ce que tu as observé indique un autre résultat à atteindre : « " + G.C.res + " »."])) }, "Le résultat à atteindre", () => secourir());
  };
  /* ----- 4. Secourir : la file d'étapes ----- */
  function secourir() {
    G.phase = "secourir";
    G.q = G.V.sub.steps(G.V).concat(G.V.comp || []); G.i = -1;
    next();
  }
  function next() {
    while (++G.i < G.q.length) {
      let s = G.q[G.i];
      if (typeof s === "function") s = s(G);
      if (Array.isArray(s)) { G.q.splice(G.i, 1, ...s); G.i--; continue; }
      if (!s) continue;
      if (typeof s === "string") { if (G.alertT != null) continue; s = alertStep(G.V, s.split(":")[1]); }
      if (s.pre) { if (s.pre.unctrl) G.ctrl = false; if (s.pre.rosc) G.rosc = true; }
      return ask(s, G.kind === "rcp" && !G.rosc ? "③ Secourir · RCP" : "③ Secourir", next);
    }
    finale();
  }
  /* Affiche une étape et applique le choix */
  function ask(s, titre, after) {
    G.cur = { s, after, o: shuffle(s.o) };
    frame('<h2 class="mdy-h">' + titre + "</h2>" + (s.img ? '<img src="' + esc(s.img) + '" alt="" style="max-height:150px;border-radius:10px;background:#fff;display:block;margin:0 auto 10px">' : "") +
      "<p><b>" + fmt(s.q) + '</b></p><div class="mdy-col">' + G.cur.o.map((o, i) => '<button class="btn big" data-a="pick" data-v="' + i + '">' + esc(o[0]) + "</button>").join("") + "</div>" + logHTML());
  }
  H.pick = (i) => {
    const { s, after, o } = G.cur, [txt, q, expl, fx = {}] = o[+i], all = s.all || {};
    pass((s.t || 10) + (fx.t || 0) + (q < 2 ? 10 : 0));
    G.vit -= fx.dmg != null ? fx.dmg : fx.crit ? 15 : q === 0 ? 4 : 0;
    for (const k of ["ctrl", "dae", "daeHere", "chocOK"]) if (fx[k] || all[k]) G[k] = true;
    if (fx.alert && G.alertT == null) { G.alertT = G.t; logm("📞 Les secours sont alertés."); }
    if (fx.crit) G.crit++;
    if (q === 2) { G.good.push(txt.replace(/^./, (c) => c.toUpperCase()) + "."); SND.good(); logm("✔ " + txt); }
    else { G.errors.push((fx.crit ? "⚠ " : "") + "« " + txt + " » : " + expl.replace(/\*\*/g, "")); SND.bad(); logm((q ? "≈ " : "✖ ") + txt); }
    if (fx.chance != null && (q === 2 || fx.chance === 1) && Math.random() < fx.chance) { G.ok = true; G.ctrl = true; logm("✔ Le corps étranger est expulsé !"); }
    if (fx.log) logm(fx.log);
    if (fx.sw) { G.kind = "rcp"; G.ctrl = false; G.soft = false; G.ok = false; G.q = G.q.slice(0, G.i + 1).concat(stepsRcp(G.V, true, G.C === CASES.eto)); }
    const go = () => (G.vit <= 0 ? end() : after());
    if (q === 2) return go();
    // Après l'erreur, la suite part du bon geste (fait avec du retard)
    const best = s.o.filter((x) => x[1] === 2);
    if (best.some((x) => x[3] && x[3].ctrl) && !fx.sw) G.ctrl = true;
    modal(fx.crit ? "⚠ Erreur grave" : q === 1 ? "Presque…" : "Erreur", "<p>" + fmt(expl) + "</p>" + (best.length ? "<p><b>✔ Le bon geste :</b> " + esc(best[0][0]) + ".</p>" : "") + (fx.crit ? '<p class="small muted">Cette erreur dégrade fortement l\'état de la victime.</p>' : ""), [["Continuer", go, "red"]]);
  };
  /* ----- 5. Surveiller, accueillir les secours, transmettre ----- */
  function finale() {
    const V = G.V;
    if (G.alertT == null && V.sub.noAlert) return end();
    if (G.alertT == null) {
      G.errors.push("⚠ Les secours n'ont pas été alertés pendant ta prise en charge : ils arrivent avec un grand retard.");
      G.crit++; G.alertT = G.t + 120; logm("✖ Personne n'a alerté les secours ! Tu le fais maintenant.");
      return modal("⚠ Et l'alerte ?", "<p>Personne n'a alerté les secours. Tu t'en rends compte maintenant : ils arriveront bien plus tard.</p>", [["Continuer", surv, "red"]]);
    }
    surv();
  }
  function surv() {
    if (G.V.sub.noSurv || CASES[G.kind].noSurv || G.kind === "rcp") return arrivee();
    G.phase = "surveiller";
    ask({ q: "En attendant les secours, que fais-tu ?", o: [
      [SURV, 2, ""],
      ["Je pars accueillir les secours à l'entrée et je la laisse seule", 0, "Le SST reste auprès de la victime : il envoie quelqu'un accueillir les secours."],
      ["Je retourne à mon poste : les secours vont arriver", 0, "On ne quitte pas la victime : surveillance jusqu'aux secours.", { crit: 1 }],
      ["Je l'aide à se lever pour aller vers la sortie", 0, "Elle reste au repos, en position d'attente.", { dmg: 8 }]] }, "④ Surveiller", arrivee);
  }
  function arrivee() {
    const dt = Math.max(0, G.alertT + G.V.eta - G.t);
    pass(dt);
    if (G.vit <= 0) return end();
    logm("🚑 Les secours arrivent.");
    const V = G.V;
    let V2 = null; for (let k = V.n + 1; !V2 || V2.sub === V.sub || !V2.sub.bil; k++) V2 = scenario(k);
    G.phase = "transmettre";
    ask({ q: "Les secours arrivent. Que leur transmets-tu ?", o: [
      ["« " + V.sub.bil(V) + " »", 2, ""],
      ["« Elle a eu un problème, je vous laisse voir. »", 0, "On transmet ce qu'on a observé et ce qu'on a fait : les secours gagnent un temps précieux."],
      ["« Ça va mieux, vous pouvez repartir. »", 0, "Les secours prennent en charge la victime : on leur transmet tout.", { crit: 1 }],
      ["« " + V2.sub.bil(V2) + " »", 0, "Ce n'est pas ce qui s'est passé : transmets ce que tu as vraiment observé et fait."]] }, "⑤ Transmettre", end);
  }
  /* ----- Fin ----- */
  function end() {
    if (G.phase === "fin") return;
    const V = G.V, ok = G.vit > 0, C = G.C;
    G.phase = "fin"; closeModal();
    let score = (ok ? 40 : 0) + Math.round(Math.max(0, G.vit) / 5) + Math.min(30, G.good.length * 3) + (G.crit ? 0 : 10) - G.errors.length * 4;
    score = Math.max(0, Math.min(100, score));
    progress.saveGame(mod.id, "victime", score);
    ok ? SND.win() : SND.bad();
    const titre = !ok ? "Trop tard…" : G.alertT == null ? "Bien pris en charge !" : G.vit >= 75 ? (G.kind === "rcp" && !G.rosc ? "Relais aux secours" : "Victime sauvée !") : "Prise en charge… difficile";
    const ko = { sai: "Le saignement n'a pas été arrêté à temps.", eto: "L'air n'est pas passé à temps.", pls: "Ses voies aériennes n'ont pas été protégées à temps.", rcp: "Pas de reprise : la RCP et le DAE sont arrivés trop tard." }[G.kind] || "Son état s'est trop aggravé.";
    const verdict = !ok ? ko : G.alertT == null ? V.nom + " va bien. Prise en charge en " + fmtT(G.t) + "." :
      G.kind === "rcp" && !G.rosc ? "Les secours prennent le relais de la RCP après " + fmtT(G.t) + "." : "Les secours prennent en charge " + V.nom + " après " + fmtT(G.t) + ". État : " + etat()[0].toLowerCase() + ".";
    frame('<div class="panel result" style="margin:0 auto;border-top-color:' + (ok && G.vit >= 75 ? "var(--ok)" : "var(--fire)") + '"><h1>' + titre + "</h1>" +
      '<div class="score">' + score + "<span>/100</span></div><div class=\"verdict\">" + esc(verdict) + "</div>" +
      (G.good.length ? '<div class="blk blk-key" style="text-align:left"><h3>' + ic("check") + "Bien joué</h3><ul>" + G.good.map((x) => "<li><span>" + esc(x) + "</span></li>").join("") + "</ul></div>" : "") +
      (G.errors.length ? '<div class="blk blk-warn" style="text-align:left"><h3>' + ic("warn") + "À corriger</h3>" + G.errors.map((x) => "<p>" + esc(x) + "</p>").join("") + "</div>" : "") +
      '<div class="blk blk-key" style="text-align:left"><h3>' + ic("target") + "À retenir</h3><ul>" + C.key.concat(G.kind !== V.kind ? CASES[G.kind].key.slice(0, 2) : []).map((x) => "<li><span>" + fmt(x) + "</span></li>").join("") + "</ul></div>" +
      '<p class="small muted">Scénario n° ' + V.n + "</p>" +
      '<div class="row"><button class="btn big red" data-a="again">' + ic("reset") + 'Rejouer cette victime</button><button class="btn big" data-a="other">' + ic("play") + 'Autre victime</button>' +
      ((mod.fiches || []).some((f) => f.id === C.fiche) ? '<button class="btn big" data-a="fiche">' + ic("book") + "Revoir la fiche</button>" : "") +
      '<button class="btn big dark" data-a="home">' + ic("back") + "Retour au module</button></div></div>");
  }
  H.again = () => start(G.V.n);
  H.home = exit;
  H.fiche = () => { cleanup(); location.hash = "#/m/" + mod.id + "/f/" + G.C.fiche; };
  /* ----- Fenêtre modale ----- */
  function modal(title, html, btns) {
    closeModal();
    const d = document.createElement("div"); d.className = "mdy-modal";
    d.innerHTML = '<div class="mdy-box"><h2>' + title + "</h2>" + html + btns.map((b, i) => '<button class="btn ' + (b[2] || "") + '" data-i="' + i + '">' + esc(b[0]) + "</button>").join("") + "</div>";
    document.body.appendChild(d);
    d.querySelectorAll("[data-i]").forEach((b) => { b.onclick = () => { const f = btns[+b.dataset.i][1]; closeModal(); if (f) f(); }; });
  }
  function closeModal() { document.querySelectorAll(".mdy-modal").forEach((m) => m.remove()); }

  start();
  return cleanup;
}
