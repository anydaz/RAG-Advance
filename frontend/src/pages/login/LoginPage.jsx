import { useState } from "react";
import OrgStep from "./OrgStep.jsx";
import PasswordStep from "./PasswordStep.jsx";

export default function LoginPage({ onLoginSuccess, theme, toggleTheme }) {
  const [step, setStep] = useState("org");
  const [org, setOrg] = useState(null);

  function handleOrgSuccess(orgData) {
    setOrg(orgData);
    setStep("password");
  }

  return (
    <div
      data-theme={theme}
      className="relative w-full min-h-screen bg-canvas text-ink transition-[background,color] duration-[250ms] ease-linear font-sans"
    >
      {step === "org" && (
        <OrgStep onSuccess={handleOrgSuccess} theme={theme} toggleTheme={toggleTheme} />
      )}
      {step === "password" && (
        <PasswordStep
          org={org}
          onSuccess={onLoginSuccess}
          onBack={() => setStep("org")}
          theme={theme}
          toggleTheme={toggleTheme}
        />
      )}
    </div>
  );
}
