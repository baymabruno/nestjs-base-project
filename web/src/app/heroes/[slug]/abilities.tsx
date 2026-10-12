import Image from "next/image";
import type {
  Ability,
  HeroAbilities,
  SkillBuild,
  TalentOption,
} from "@/lib/api";
import { abilityImage, integer, percent } from "@/lib/format";

function AbilityIcon({
  ability,
  level,
}: {
  ability: Ability | null;
  level: number;
}) {
  const name = ability?.displayName ?? ability?.name ?? "Desconhecida";
  return (
    <figure className="ability" title={`Nível ${level}: ${name}`}>
      {ability && !ability.isTalent ? (
        <Image
          src={abilityImage(ability.name)}
          alt={name}
          width={44}
          height={44}
        />
      ) : (
        // talents have no icon
        <span className="ability-talent" aria-label={name}>
          T
        </span>
      )}
      <figcaption>{level}</figcaption>
    </figure>
  );
}

function Build({ build }: { build: SkillBuild }) {
  return (
    <div className="build">
      <div className="build-stats">
        {integer(build.matches)} partidas ·{" "}
        <strong>{percent(build.winRate)}</strong> win rate ·{" "}
        {percent(build.pickRate)} das partidas
      </div>
      <div className="build-abilities">
        {build.abilities.map((ability, index) => (
          <AbilityIcon key={index} ability={ability} level={index + 1} />
        ))}
      </div>
    </div>
  );
}

function TalentCell({
  option,
  tag,
  chosen,
}: {
  option?: TalentOption;
  tag?: string;
  chosen: boolean;
}) {
  if (!option) return <div className="talent" />;
  return (
    <div className={`talent${chosen ? " talent-chosen" : ""}`}>
      <div className="talent-name">{option.displayName ?? option.name}</div>
      <div className="talent-stats">
        Escolha {percent(option.pickRate)} · Win{" "}
        <span
          className={
            option.winRate !== null && option.winRate >= 0.5 ? "good" : ""
          }
        >
          {percent(option.winRate)}
        </span>
      </div>
      {tag && <div className="talent-tag">{tag}</div>}
    </div>
  );
}

/** Tags of the two options: one may be both the most picked and the best */
function tagsOf([left, right]: TalentOption[]): [string?, string?] {
  if (!left || !right || left.matches + right.matches === 0) return [];
  const picked = left.matches >= right.matches ? 0 : 1;
  const rates = [left.winRate ?? 0, right.winRate ?? 0];
  const best = rates[0] >= rates[1] ? 0 : 1;
  const tags: [string?, string?] = [];
  if (picked === best) tags[picked] = "Escolha principal";
  else {
    tags[picked] = "Mais escolhido";
    tags[best] = "Maior win rate";
  }
  return tags;
}

export function AbilitiesSection({
  data,
  roleName,
}: {
  data: HeroAbilities;
  /** the talents are of this role (empty: every role) */
  roleName?: string;
}) {
  const { skillBuild, talents } = data;
  // only the most played build: the others have small samples
  const [build] = skillBuild.builds;
  return (
    <div className="card">
      <h2>Habilidades e talentos</h2>
      <p className="hint">
        A sequência mais usada nos 10 primeiros níveis, entre as{" "}
        {integer(skillBuild.matches)} partidas com a ordem de habilidades
        conhecida, de todas as funções. Só as partidas processadas pelo OpenDota
        têm essa ordem, quase todas profissionais (do patch inteiro), então a
        sequência não segue o filtro de partidas. Passe o mouse sobre cada
        nível para ver a habilidade.
      </p>
      {build ? (
        <Build build={build} />
      ) : (
        <p className="muted">
          Ainda não há partidas com a ordem de habilidades deste herói.
        </p>
      )}

      <h2>Árvore de talentos</h2>
      {!talents.available ? (
        <p className="muted">
          Os dados de talentos ainda não estão disponíveis.
        </p>
      ) : (
        <>
          <p className="hint">
            Talentos escolhidos em partidas ranqueadas Divine e Immortal da
            última semana{roleName ? ` jogando de ${roleName}` : ""}, com dados
            do STRATZ. A escolha é a parcela de cada lado no nível.
          </p>
          <div className="talent-tree">
            {talents.tiers.map((tier) => {
              const [left, right] = tier.options;
              const tags = tagsOf(tier.options);
              return (
                <div key={tier.level} className="talent-row">
                  <TalentCell
                    option={left}
                    tag={tags[0]}
                    chosen={tags[0] === "Escolha principal"}
                  />
                  <div className="talent-level">
                    <span>{tier.level}</span>
                  </div>
                  <TalentCell
                    option={right}
                    tag={tags[1]}
                    chosen={tags[1] === "Escolha principal"}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
