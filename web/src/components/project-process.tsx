"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

const steps = [
  ["Share", "Your goals & workflow"],
  ["Plan", "Agree on the scope"],
  ["Build", "Connect, test & review"],
  ["Handoff", "Walk through the system"],
] as const;

export function ProjectProcess() {
  const [replay, setReplay] = useState(0);
  return (
    <section className="project-process" data-home-surface="tint" data-reveal="process" aria-labelledby="project-process-title">
      <div className="project-process-header">
        <div><h2 id="project-process-title">From your idea to a working system.</h2><p>How we can work together</p></div>
        <button type="button" className="hero-link" onClick={() => setReplay(value => value + 1)} aria-label="Replay project process animation"><Icon name="replay" /> Replay</button>
      </div>
      <ol className="project-process-steps" key={replay}>
        {steps.map(([title, detail], index) => (
          <li key={title}><span className="project-process-number" aria-hidden="true">0{index + 1}</span><h3>{title}</h3><p>{detail}</p></li>
        ))}
      </ol>
    </section>
  );
}
