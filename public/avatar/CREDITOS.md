# Créditos dos avatares do TutorIA

Spec: `SDD/2026-10-23_avatar-personas-por-materia.md` (RNF06).

Critério para personas inspiradas em pessoas reais: morte há pelo menos 100 anos, retrato
de referência em domínio público, nenhum licenciamento ativo da imagem e uso de prenome/alcunha
com crédito descritivo ("inspirado em"). As personas são interpretações estilizadas (cartoon 3D),
nunca réplicas fotográficas.

## Substituição do modelo provisório (RF14)

- O arquivo provisório `tutor.vrm` (`AvatarSample_B`, VRoid Project / pixiv Inc.) foi removido do repositório e do build; `personas/lia.vrm` assumiu o papel de modelo padrão (`geral`).

## Personas

| Persona | Arquivo | Referência | Morte | Retrato de referência | Uso do nome / INPI | Modelo 3D (autor e licença) |
|---|---|---|---|---|---|---|
| Lia | `personas/lia.vrm` | Original | — | — | Nome original do projeto | Autoral TutorIA (`scripts/gerar-personas-vrm.ts`), VRM Public License 1.0 / MIT |
| Prof. Átomo | `personas/prof-atomo.vrm` | Original (arquétipo do cientista; não é Einstein) | — | — | Nome original do projeto | Autoral TutorIA (`scripts/gerar-personas-vrm.ts`), VRM Public License 1.0 / MIT (óculos na testa e cavanhaque; sem uso do nome "Einstein") |
| Ada | `personas/ada.vrm` | Ada Lovelace | 1852 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:Ada_Lovelace) (domínio público) | Prenome ("Ada") com crédito descritivo; conferência formal no INPI recomendada antes da publicação | Autoral TutorIA (`scripts/gerar-personas-vrm.ts`), VRM Public License 1.0 / MIT |
| Oswaldo | `personas/oswaldo.vrm` | Oswaldo Cruz | 1917 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:Oswaldo_Cruz) (domínio público) | Prenome ("Oswaldo") com crédito descritivo; conferência formal no INPI recomendada antes da publicação | Autoral TutorIA (`scripts/gerar-personas-vrm.ts`), VRM Public License 1.0 / MIT |
| Machado | `personas/machado.vrm` | Machado de Assis | 1908 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:Machado_de_Assis) (domínio público) | Alcunha literária ("Machado") com crédito descritivo; conferência formal no INPI recomendada antes da publicação | Autoral TutorIA (`scripts/gerar-personas-vrm.ts`), VRM Public License 1.0 / MIT |
| Humboldt | `personas/humboldt.vrm` | Alexander von Humboldt | 1859 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:Alexander_von_Humboldt) (domínio público) | Sobrenome histórico ("Humboldt") com crédito descritivo; conferência formal no INPI recomendada antes da publicação | Autoral TutorIA (`scripts/gerar-personas-vrm.ts`), VRM Public License 1.0 / MIT |
| Heródoto | `personas/herodoto.vrm` | Heródoto | c. 425 a.C. | Não há retrato real; aparência livre | Nome histórico clássico ("Heródoto"); conferência formal no INPI recomendada antes da publicação | Autoral TutorIA (`scripts/gerar-personas-vrm.ts`), VRM Public License 1.0 / MIT |

## Animações

14 clipes no formato `tutoria-clipe-vrm` listados em `animacoes/manifesto.json` (~633 KB no total; limite do RNF02: ≤ 3 MB), gerados por `scripts/gerar-clipes-animacao.ts` (autoral TutorIA, licença MIT):
- `idle`: `repouso-respirando.json`, `repouso-troca-peso.json`
- `listening`: `escuta-aceno.json`
- `thinking`: `pensando-queixo.json`, `pensando-olhar.json`
- `speaking`: `falando-palmas-abertas.json`, `falando-enfatizar.json`, `falando-mao-no-peito.json`, `falando-comparar.json`, `falando-contar-dedos.json`, `falando-eureka-atomo.json` (exclusivo de `prof-atomo`)
- `apontar`: `apontar-lado.json`, `apontar-frente.json`
- `cumprimentar`: `cumprimentar-aceno.json`

Clipes adicionais do [Mixamo](https://www.mixamo.com) (Adobe) ou gravador local (`gravador.html`) podem ser adicionados em `animacoes/manifesto.json` sem alteração de código.
