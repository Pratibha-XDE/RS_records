<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- All data access goes through src/services/* (localStorage store today); UI never touches storage directly, so services can be swapped for Django REST calls.
- Wage math lives only in src/utils/wageCalculator.ts (paise integers); non-hourly rules are isolated in WAGE_RULES until finalised.
