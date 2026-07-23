# Step 2: Review the Change

For each changed persistent field:

1. verify fresh initialization;
2. verify repeated initialization;
3. verify upgrade from the oldest supported state;
4. decide export inclusion;
5. define import default and validation;
6. verify secret encryption or exclusion;
7. define rollback limits.

Reject schema-only patches that leave archive behavior undefined.

Proceed to [Step 3: Verify](03-verify.md).
