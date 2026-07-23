# Step 2: Rebuild and Upgrade

1. Create a synchronization branch from the configured production branch.
2. Integrate the exact reviewed upstream SHA.
3. Resolve conflicts by preserving current requirements, upstream security behavior, and all relevant tests.
4. Run configured unit, integration, schema, localization, build, type, and diff checks.
5. Push a non-production review branch first when production deploys on branch push.
6. Update the production branch only after review gates pass.
7. Verify the deployment updated the existing service and existing bindings.
8. Complete automated and user-authenticated production smoke checks.

Stop before mirror-branch changes when any production gate fails.

Proceed to [Step 3: Finalize](03-finalize.md).
